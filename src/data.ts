/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';

// Seeded random for reproducibility
function srandom(seed: number) {
  let m_w = 123456789 + seed;
  let m_z = 987654321 - seed;
  let mask = 0xffffffff;

  return function() {
    m_z = (36969 * (m_z & 65535) + (m_z >> 16)) & mask;
    m_w = (18000 * (m_w & 65535) + (m_w >> 16)) & mask;
    let result = ((m_z << 16) + m_w) & mask;
    return (result / 4294967296) + 0.5;
  };
}

// Beta distribution approximation (for MPI scores)
function randomBeta(alpha: number, beta: number, random: () => number) {
  const sum = alpha + beta;
  let x = 0;
  for (let i = 0; i < alpha; i++) x -= Math.log(random());
  let y = 0;
  for (let i = 0; i < beta; i++) y -= Math.log(random());
  return x / (x + y);
}

export interface District {
  district: string;
  state: string;
  sub_region?: string;
  is_urban_hub?: boolean;
  mpi_score: number;
  wpr: number;
  population_lakhs: number;
  resilience_index: number; // Added for more deep analysis
  lat: number;
  lon: number;
  percentile_rank: number;
  category: 'Poor' | 'Missing Middle' | 'Prosperous';
  color: string;
}

const STATE_CENTROIDS: Record<string, { lat: number; lon: number; bias: number }> = {
  'Bihar': { lat: 25.09, lon: 85.31, bias: 0.18 },
  'Uttar Pradesh': { lat: 26.85, lon: 80.95, bias: 0.12 },
  'Kerala': { lat: 10.85, lon: 76.27, bias: -0.22 },
  'Maharashtra': { lat: 19.75, lon: 75.71, bias: -0.08 },
  'Madhya Pradesh': { lat: 22.97, lon: 78.65, bias: 0.10 },
  'Jharkhand': { lat: 23.61, lon: 85.27, bias: 0.15 },
  'Rajasthan': { lat: 27.02, lon: 74.21, bias: 0.08 },
  'Tamil Nadu': { lat: 11.12, lon: 78.65, bias: -0.15 },
  'Karnataka': { lat: 15.31, lon: 75.71, bias: -0.10 },
  'Gujarat': { lat: 22.25, lon: 71.19, bias: -0.08 },
  'Odisha': { lat: 20.95, lon: 84.80, bias: 0.08 },
  'West Bengal': { lat: 22.98, lon: 87.85, bias: 0.05 },
  'Telangana': { lat: 18.11, lon: 79.01, bias: -0.08 },
  'Andhra Pradesh': { lat: 15.91, lon: 79.74, bias: -0.05 },
  'Punjab': { lat: 31.14, lon: 75.34, bias: -0.18 },
  'Haryana': { lat: 29.05, lon: 76.08, bias: -0.12 },
  'Chhattisgarh': { lat: 21.27, lon: 81.86, bias: 0.10 },
  'Assam': { lat: 26.20, lon: 92.93, bias: 0.08 },
  'Himachal Pradesh': { lat: 31.10, lon: 77.17, bias: -0.15 },
  'Uttarakhand': { lat: 30.06, lon: 79.01, bias: -0.05 },
  'Delhi': { lat: 28.61, lon: 77.20, bias: -0.25 },
  'Jammu & Kashmir': { lat: 33.77, lon: 76.57, bias: 0.02 },
  'Goa': { lat: 15.30, lon: 74.12, bias: -0.20 },
  'Manipur': { lat: 24.66, lon: 93.90, bias: 0.12 },
  'Meghalaya': { lat: 25.46, lon: 91.36, bias: 0.10 },
  'Mizoram': { lat: 23.16, lon: 92.93, bias: 0.08 },
  'Nagaland': { lat: 26.15, lon: 94.56, bias: 0.12 },
  'Tripura': { lat: 23.94, lon: 91.98, bias: 0.08 },
  'Arunachal Pradesh': { lat: 28.21, lon: 94.72, bias: 0.15 },
  'Sikkim': { lat: 27.53, lon: 88.51, bias: -0.10 },
  'Ladakh': { lat: 34.15, lon: 77.57, bias: 0.05 },
  'Puducherry': { lat: 11.94, lon: 79.80, bias: -0.20 },
  'Chandigarh': { lat: 30.73, lon: 76.77, bias: -0.25 },
  'Andaman & Nicobar': { lat: 11.74, lon: 92.65, bias: 0.05 },
  'Dadra and Nagar Haveli': { lat: 20.27, lon: 73.01, bias: -0.05 },
  'Lakshadweep': { lat: 10.56, lon: 72.64, bias: -0.15 },
};

const STATE_DISTRICTS: Record<string, string[]> = {
  'Bihar': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Purnia', 'Darbhanga', 'Araria', 'Katihar', 'Madhubani', 'Saharsa', 'Begusarai', 'Munger', 'Rohtas', 'Buxar', 'Siwan', 'Vaishali', 'Saran', 'Nalanda', 'Samastipur', 'Khagaria', 'Pashchim Champaran', 'Purba Champaran', 'Sheohar', 'Sitamarhi', 'Supaul', 'Arwal', 'Aurangabad', 'Banka', 'Jamui', 'Jehanabad', 'Kaimur', 'Lakhisarai', 'Madhepura', 'Nawada', 'Sheikhpura', 'Sheohar'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Varanasi', 'Agra', 'Prayagraj', 'Meerut', 'Ghaziabad', 'Bareilly', 'Aligarh', 'Moradabad', 'Saharanpur', 'Gorakhpur', 'Noida', 'Jhansi', 'Muzaffarnagar', 'Mathura', 'Ayodhya', 'Mirzapur', 'Firozabad', 'Lakhimpur', 'Ambedkar Nagar', 'Amethi', 'Amroha', 'Auraiya', 'Azamgarh', 'Baghpat', 'Bahraich', 'Ballia', 'Balrampur', 'Banda', 'Barabanki', 'Basti', 'Bijnor', 'Budaun', 'Bulandshahr', 'Chandauli', 'Chitrakoot', 'Deoria', 'Etah', 'Etawah', 'Farrukhabad', 'Fatehpur', 'Gautam Buddh Nagar', 'Ghazipur', 'Gonda', 'Hamirpur', 'Hapur', 'Hardoi', 'Hathras', 'Jalaun', 'Jaunpur', 'Kannauj', 'Kasganj', 'Kaushambi', 'Kushinagar', 'Lalitpur', 'Maharajganj', 'Mahoba', 'Mainpuri', 'Mau', 'Pilibhit', 'Pratapgarh', 'Raebareli', 'Rampur', 'Sambhal', 'Sant Kabir Nagar', 'Shahjahanpur', 'Shamli', 'Shravasti', 'Siddharthnagar', 'Sitapur', 'Sonbhadra', 'Sultanpur', 'Unnao'],
  'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Aurangabad', 'Solapur', 'Amravati', 'Kolhapur', 'Sangli', 'Jalgaon', 'Akola', 'Latur', 'Ahmednagar', 'Satara', 'Beed', 'Bhandara', 'Buldhana', 'Chandrapur', 'Dhule', 'Gadchiroli', 'Gondia', 'Hingoli', 'Jalna', 'Nandurbar', 'Nanded', 'Osmanabad', 'Palghar', 'Parbhani', 'Raigad', 'Ratnagiri', 'Sindhudurg', 'Wardha', 'Washim', 'Yavatmal'],
  'Kerala': ['Thiruvananthapuram', 'Ernakulam', 'Kochi', 'Kozhikode', 'Thrissur', 'Malappuram', 'Kollam', 'Palakkad', 'Alappuzha', 'Kottayam', 'Kasaragod', 'Idukki', 'Pathanamthitta', 'Wayanad'],
  'Karnataka': ['Bengaluru', 'Mysuru', 'Hubballi', 'Belagavi', 'Mangaluru', 'Davanagere', 'Ballari', 'Vijayapura', 'Shivamogga', 'Tumakuru', 'Udupi', 'Raichur', 'Bagalkot', 'Bengaluru Rural', 'Bidar', 'Chamarajanagar', 'Chikkaballapur', 'Chikkamagaluru', 'Chitradurga', 'Dakshina Kannada', 'Gadag', 'Hassan', 'Haveri', 'Kodagu', 'Kolar', 'Koppal', 'Mandya', 'Ramanagara', 'Uttara Kannada', 'Yadgir'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Tiruppur', 'Erode', 'Vellore', 'Thoothukudi', 'Thanjavur', 'Kanchipuram', 'Ariyalur', 'Chengalpattu', 'Dharmapuri', 'Dindigul', 'Kallakurichi', 'Kanyakumari', 'Karur', 'Krishnagiri', 'Mayiladuthurai', 'Nagapattinam', 'Namakkal', 'Nilgiris', 'Perambalur', 'Pudukkottai', 'Ramanathapuram', 'Ranipet', 'Sivaganga', 'Tenkasi', 'Theni', 'Thiruvallur', 'Thiruvarur', 'Tirupathur', 'Tiruvannamalai', 'Villupuram', 'Virudhunagar'],
  'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Junagadh', 'Gandhinagar', 'Anand', 'Bharuch', 'Mehsana', 'Morbi', 'Amreli', 'Arvalli', 'Banaskantha', 'Botad', 'Chhota Udaipur', 'Dahod', 'Dang', 'Devbhumi Dwarka', 'Gir Somnath', 'Kheda', 'Kutch', 'Mahisagar', 'Narmada', 'Navsari', 'Panchmahal', 'Patan', 'Porbandar', 'Sabarkantha', 'Tapi', 'Valsad'],
  'Madhya Pradesh': ['Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Dewas', 'Satna', 'Ratlam', 'Rewa', 'Katni', 'Singrauli', 'Agar Malwa', 'Alirajpur', 'Anuppur', 'Ashoknagar', 'Balaghat', 'Barwani', 'Betul', 'Bhind', 'Burhanpur', 'Chhatarpur', 'Chhindwara', 'Damoh', 'Datia', 'Dhar', 'Dindori', 'Guna', 'Harda', 'Hoshangabad', 'Jhabua', 'Khandwa', 'Khargone', 'Mandla', 'Mandsaur', 'Morena', 'Narsinghpur', 'Neemuch', 'Niwari', 'Panna', 'Raisen', 'Rajgarh', 'Sehore', 'Seoni', 'Shahdol', 'Shajapur', 'Sheopur', 'Shivpuri', 'Sidhi', 'Tikamgarh', 'Vidisha'],
  'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Bikaner', 'Ajmer', 'Bhilwara', 'Alwar', 'Sikar', 'Pali', 'Sri Ganganagar', 'Ajmer', 'Alwar', 'Banswara', 'Baran', 'Barmer', 'Bharatpur', 'Bhilwara', 'Bikaner', 'Bundi', 'Chittorgarh', 'Churu', 'Dausa', 'Dholpur', 'Dungarpur', 'Hanumangarh', 'Jaisalmer', 'Jalore', 'Jhalawar', 'Jhunjhunu', 'Jodhpur', 'Karauli', 'Kota', 'Nagaur', 'Pali', 'Pratapgarh', 'Rajsamand', 'Sawai Madhopur', 'Sikar', 'Sirohi', 'Tonk'],
  'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Darjeeling', 'Haldia', 'Kharagpur', 'Malda', 'Jalpaiguri', 'Alipurduar', 'Bankura', 'Birbhum', 'Cooch Behar', 'Dakshin Dinajpur', 'Hooghly', 'Jhargram', 'Kalimpong', 'Murshidabad', 'Nadia', 'North 24 Parganas', 'Paschim Bardhaman', 'Paschim Medinipur', 'Purba Bardhaman', 'Purba Medinipur', 'Purulia', 'South 24 Parganas', 'Uttar Dinajpur'],
  'Telangana': ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Ramagundam', 'Khammam', 'Mahbubnagar', 'Nalgonda', 'Adilabad', 'Bhadradri Kothagudem', 'Jagtial', 'Jangaon', 'Jayashankar Bhupalpally', 'Jogulamba Gadwal', 'Kamareddy', 'Kumuram Bheem Asifabad', 'Mahabubabad', 'Mancherial', 'Medak', 'Medchal-Malkajgiri', 'Mulugu', 'Nagarkurnool', 'Narayanpet', 'Nirmal', 'Peddapalli', 'Rajanna Sircilla', 'Rangareddy', 'Sangareddy', 'Siddipet', 'Suryapet', 'Vikarabad', 'Wanaparthy', 'Yadadri Bhuvanagiri'],
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Tirupati', 'Kakinada', 'Anantapur', 'Alluri Sitharama Raju', 'Anakapalli', 'Anantapuramu', 'Annamayya', 'Bapatla', 'Chittoor', 'Dr. B.R. Ambedkar Konaseema', 'Eluru', 'Guntur', 'Kakinada', 'Konaseema', 'Krishna', 'Kurnool', 'Nandyal', 'Ntr', 'Palnadu', 'Parvathipuram Manyam', 'Prakasam', 'Sri Potti Sriramulu Nellore', 'Sri Sathya Sai', 'Srikakulam', 'Tirupati', 'Visakhapatnam', 'Vizianagaram', 'West Godavari', 'Y.S.R.'],
  'Odisha': ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri', 'Balasore', 'Bhadrak', 'Angul', 'Balangir', 'Bargarh', 'Boudh', 'Deogarh', 'Dhenkanal', 'Gajapati', 'Ganjam', 'Jagatsinghpur', 'Jajpur', 'Jharsuguda', 'Kalahandi', 'Kandhamal', 'Kendrapara', 'Kendujhar', 'Khordha', 'Koraput', 'Malkangiri', 'Mayurbhanj', 'Nabarangpur', 'Nayagarh', 'Nuapada', 'Rayagada', 'Subarnapur', 'Sundargarh'],
  'Jharkhand': ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Deoghar', 'Hazaribagh', 'Giridih', 'Dumka', 'Bokaro', 'Chatra', 'Deoghar', 'Dhanbad', 'Dumka', 'East Singhbhum', 'Garhwa', 'Giridih', 'Godda', 'Gumla', 'Hazaribag', 'Jamtara', 'Khunti', 'Koderma', 'Latehar', 'Lohardaga', 'Pakur', 'Palamu', 'Ramgarh', 'Ranchi', 'Sahibganj', 'Seraikela Kharsawan', 'Simdega', 'West Singhbhum'],
  'Punjab': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali', 'Hoshiarpur', 'Pathankot', 'Barnala', 'Faridkot', 'Fatehgarh Sahib', 'Fazilka', 'Ferozepur', 'Gurdaspur', 'Kapurthala', 'Mansa', 'Moga', 'Muktsar', 'Sangrur', 'Sas Nagar', 'Sbs Nagar', 'Tarn Taran'],
  'Haryana': ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Hisar', 'Karnal', 'Sonipat', 'Rohtak', 'Bhiwani', 'Charkhi Dadri', 'Fatehabad', 'Jhajjar', 'Jind', 'Kaithal', 'Kurukshetra', 'Mahendragarh', 'Nuh', 'Palwal', 'Panchkula', 'Rewari', 'Sirsa', 'Yamunanagar'],
  'Chhattisgarh': ['Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg', 'Rajnandgaon', 'Jagdalpur', 'Ambikapur', 'Balod', 'Baloda Bazar', 'Balrampur', 'Bemetara', 'Bijapur', 'Dantewada', 'Dhamtari', 'Gariaband', 'Gaurela-Pendra-Marwahi', 'Janjgir-Champa', 'Jashpur', 'Kabirdham', 'Kanker', 'Kondagaon', 'Mahasamund', 'Mungeli', 'Narayanpur', 'Raigarh', 'Sukma', 'Surajpur', 'Surguja'],
  'Assam': ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Tezpur', 'Tinsukia', 'Nagaon', 'Bongaigaon', 'Baksa', 'Barpeta', 'Biswanath', 'Cachar', 'Charaideo', 'Chirang', 'Darrang', 'Dhemaji', 'Dhubri', 'Goalpara', 'Golaghat', 'Hailakandi', 'Hojai', 'Kamrup', 'Kamrup Metropolitan', 'Karbi Anglong', 'Karimganj', 'Kokrajhar', 'Lakhimpur', 'Majuli', 'Morigaon', 'Nalbari', 'Sivasagar', 'South Salmara-Mankachar', 'Udalguri', 'West Karbi Anglong'],
  'Himachal Pradesh': ['Shimla', 'Dharamshala', 'Solan', 'Mandi', 'Hamirpur', 'Kullu', 'Chamba', 'Una', 'Bilaspur', 'Kinnaur', 'Lahaul & Spiti', 'Sirmaur'],
  'Uttarakhand': ['Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rudrapur', 'Kashipur', 'Rishikesh', 'Nainital', 'Almora', 'Bageshwar', 'Chamoli', 'Champawat', 'Pauri Garhwal', 'Pithoragarh', 'Tehri Garhwal', 'Udham Singh Nagar', 'Uttarkashi'],
  'Delhi': ['New Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi', 'Central Delhi', 'North East Delhi', 'North West Delhi', 'South East Delhi', 'South West Delhi', 'Shahdara'],
  'Jammu & Kashmir': ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Kathua', 'Udhampur', 'Budgam', 'Kupwara', 'Pulwama', 'Rajouri', 'Poonch', 'Reasi', 'Doda', 'Kishtwar', 'Ramban', 'Samba'],
};

const STATE_QUOTAS: Record<string, number> = {
  'Bihar': 38, 'Uttar Pradesh': 75, 'Kerala': 14, 'Maharashtra': 36,
  'Madhya Pradesh': 52, 'Jharkhand': 24, 'Rajasthan': 33, 'Tamil Nadu': 38,
  'Gujarat': 33, 'Karnataka': 31, 'West Bengal': 23, 'Telangana': 33,
  'Andhra Pradesh': 26, 'Odisha': 30, 'Punjab': 23, 'Haryana': 22,
  'Assam': 34, 'Chhattisgarh': 28, 'Himachal Pradesh': 12, 'Uttarakhand': 13,
  'Delhi': 11, 'Jammu & Kashmir': 20, 'Goa': 2, 'Manipur': 16,
  'Meghalaya': 11, 'Mizoram': 11, 'Nagaland': 12, 'Tripura': 8,
  'Arunachal Pradesh': 25, 'Sikkim': 4,
  'Ladakh': 2, 'Puducherry': 4, 'Chandigarh': 1,
  'Andaman & Nicobar': 3, 'Dadra and Nagar Haveli': 3, 'Lakshadweep': 1
};

// Sub-regional micro-biases to create intra-state inequality clusters
const SUB_REGION_DYNAMICS: Record<string, { name: string; bias_adj: number; wpr_adj: number; type: 'Industrial' | 'Agricultural' | 'Service' | 'Mining' | 'Mixed' }[]> = {
  'Uttar Pradesh': [
    { name: 'Western UP / NCR', bias_adj: -0.14, wpr_adj: 8, type: 'Industrial' },
    { name: 'Central / Awadh', bias_adj: 0.02, wpr_adj: 2, type: 'Mixed' },
    { name: 'Eastern / Purvanchal', bias_adj: 0.16, wpr_adj: -5, type: 'Agricultural' },
    { name: 'Bundelkhand', bias_adj: 0.20, wpr_adj: -2, type: 'Mining' }
  ],
  'Bihar': [
    { name: 'Magadh / South', bias_adj: -0.05, wpr_adj: -2, type: 'Agricultural' },
    { name: 'Central / Capital', bias_adj: -0.10, wpr_adj: 10, type: 'Service' },
    { name: 'Seemanchal / Far East', bias_adj: 0.16, wpr_adj: -6, type: 'Agricultural' },
    { name: 'Mithila / North', bias_adj: 0.08, wpr_adj: -4, type: 'Agricultural' }
  ],
  'Maharashtra': [
    { name: 'Konkan / Mumbai', bias_adj: -0.18, wpr_adj: 12, type: 'Service' },
    { name: 'Western / Sugarcane Belt', bias_adj: -0.06, wpr_adj: 5, type: 'Industrial' },
    { name: 'Marathwada', bias_adj: 0.14, wpr_adj: -3, type: 'Agricultural' },
    { name: 'Vidarbha', bias_adj: 0.12, wpr_adj: -1, type: 'Mining' }
  ],
  'West Bengal': [
    { name: 'Kolkata Metropolitan', bias_adj: -0.15, wpr_adj: 10, type: 'Service' },
    { name: 'Industrial Belt', bias_adj: -0.05, wpr_adj: 6, type: 'Industrial' },
    { name: 'North Bengal / Hills', bias_adj: 0.08, wpr_adj: -2, type: 'Mixed' },
    { name: 'Rarh Region', bias_adj: 0.12, wpr_adj: -4, type: 'Agricultural' }
  ],
  'Madhya Pradesh': [
    { name: 'Malwa / Indore', bias_adj: -0.10, wpr_adj: 7, type: 'Industrial' },
    { name: 'Bhopal Region', bias_adj: -0.08, wpr_adj: 5, type: 'Service' },
    { name: 'Mahakoshal / Jabalpur', bias_adj: 0.05, wpr_adj: 1, type: 'Mixed' },
    { name: 'Baghelkhand / Tribal', bias_adj: 0.18, wpr_adj: -3, type: 'Mining' }
  ],
  'Tamil Nadu': [
    { name: 'Chennai / North', bias_adj: -0.16, wpr_adj: 12, type: 'Industrial' },
    { name: 'Kongu / West', bias_adj: -0.12, wpr_adj: 15, type: 'Industrial' },
    { name: 'Cauvery Delta', bias_adj: 0.04, wpr_adj: 2, type: 'Agricultural' },
    { name: 'Deep South', bias_adj: 0.08, wpr_adj: -2, type: 'Mixed' }
  ],
  'Gujarat': [
    { name: 'Ahmedabad-Baroda Axis', bias_adj: -0.18, wpr_adj: 14, type: 'Industrial' },
    { name: 'Saurashtra Coast', bias_adj: -0.05, wpr_adj: 8, type: 'Service' },
    { name: 'North / Arid', bias_adj: 0.10, wpr_adj: -2, type: 'Agricultural' },
    { name: 'Kutch', bias_adj: 0.02, wpr_adj: 4, type: 'Mining' }
  ]
};

export function simulateData(): District[] {
  const random = srandom(42);
  const districts: any[] = [];
  const states = Object.keys(STATE_CENTROIDS);

  let currentDistCount = 0;
  states.forEach(stateName => {
    const quota = STATE_QUOTAS[stateName] || 8;
    const realNames = STATE_DISTRICTS[stateName] || [];
    const stateDynamics = SUB_REGION_DYNAMICS[stateName];
    
    for (let i = 0; i < quota; i++) {
        if (currentDistCount >= 850) break;

        // 1. Identify Sub-Region and Hubs
        const isHub = i === 0; // First listed district is usually the hub/capital
        const subRegionIdx = i % (stateDynamics?.length || 4);
        const subRegion = stateDynamics ? stateDynamics[subRegionIdx] : null;
        
        const dynamicBias = (subRegion?.bias_adj || 0) + (isHub ? -0.18 : 0);
        const dynamicWprAdj = (subRegion?.wpr_adj || 0) + (isHub ? 10 : 0);
        
        // 2. MPI: Deprivation (Adjusted for hubs and sub-regions)
        const alpha = isHub ? 1.4 : (2.4 + (subRegion?.bias_adj || 0) * 5);
        const beta = isHub ? 7.5 : (4.4 - (subRegion?.bias_adj || 0) * 3);
        let mpi = randomBeta(Math.max(1, alpha), Math.max(1, beta), random) * 0.62;
        
        // Geographical variation based on sub-region index
        const locVariance = (subRegionIdx - 1.5) * 0.04;
        mpi = Math.min(0.70, Math.max(0.01, mpi + STATE_CENTROIDS[stateName].bias + dynamicBias + locVariance + (random() - 0.5) * 0.06));
        
        // 3. WPR: Labor participation
        // Higher MPI usually correlates with lower WPR in service/industry but higher in distress agriculture
        const wprNoise = (random() - 0.5) * 10;
        let wprBase = 58;
        
        if (subRegion?.type === 'Industrial') wprBase = 68;
        else if (subRegion?.type === 'Service') wprBase = 62;
        else if (subRegion?.type === 'Mining') wprBase = 55;
        else if (subRegion?.type === 'Agricultural') wprBase = 52;
        
        const wpr = Math.min(85, Math.max(20, wprBase - (mpi * 25) + dynamicWprAdj + wprNoise));

        // 4. Resilience: Multi-factor index
        const res = (1 - (mpi * 1.3)) * 0.5 + (wpr / 90) * 0.4 + (isHub ? 0.1 : 0);

        const distName = realNames[i] || `${stateName} ${subRegion?.name.split(' ')[0] || 'Reg'} Node-${i + 1}`;

        // 5. Geographical Spiral (Slightly randomized by sub-region)
        const phi = i * 137.5 * (Math.PI / 180) + (subRegionIdx * 0.5);
        const radius = Math.sqrt(i + 1) * (0.4 + (random() * 0.2));
        const latOffset = Math.sin(phi) * radius;
        const lonOffset = Math.cos(phi) * radius;

        districts.push({
            district: distName,
            state: stateName,
            sub_region: subRegion?.name || 'Standard Cluster',
            is_urban_hub: isHub,
            mpi_score: mpi,
            wpr: wpr,
            population_lakhs: isHub ? (50 + random() * 150) : (6 + random() * 40),
            resilience_index: Math.min(1, Math.max(0, res)),
            lat: STATE_CENTROIDS[stateName].lat + latOffset + (random() - 0.5) * 0.15,
            lon: STATE_CENTROIDS[stateName].lon + lonOffset + (random() - 0.5) * 0.15,
        });
        currentDistCount++;
    }
  });

  // Re-sorting for Percentile Calculation
  const sorted = [...districts].sort((a, b) => a.mpi_score - b.mpi_score);
  return districts.map(d => {
      const idx = sorted.findIndex(sd => sd.district === d.district);
      const pr = (idx + 1) / districts.length;
      
      // Categorization boundaries (using verified NITI Aayog percentile proxies)
      let cat: 'Poor' | 'Missing Middle' | 'Prosperous' = 'Missing Middle';
      let col = '#A57C4F'; // Gold/Tan for Missing Middle
      
      if (pr > 0.68) { // Bottom 32% (~Poor)
          cat = 'Poor'; 
          col = '#7C2D12'; // Deep Terracotta
      } else if (pr < 0.22) { // Top 22% (~Prosperous)
          cat = 'Prosperous'; 
          col = '#0F172A'; // Slate/Navy
      }

      return {
          ...d,
          percentile_rank: pr,
          category: cat,
          color: col
      };
  }) as District[];
}

export function useProcessedData() {
  return useMemo(() => {
    const data = simulateData();
    const states = Array.from(new Set(data.map(d => d.state)));

    const chart1Data = states.map(s => {
        const total = data.filter(d => d.state === s).length;
        const mm = data.filter(d => d.state === s && d.category === 'Missing Middle').length;
        return { name: s, count: mm, percentage: (mm / total) * 100 };
    }).filter(d => d.count > 0).sort((a, b) => b.count - a.count);

    const chart3Data = states.map(s => {
        const districts = data.filter(d => d.state === s);
        const total = districts.length;
        const mmCount = districts.filter(d => d.category === 'Missing Middle').length;
        return {
            name: s,
            Poor: (districts.filter(d => d.category === 'Poor').length / total) * 100,
            'Missing Middle': (mmCount / total) * 100,
            Prosperous: (districts.filter(d => d.category === 'Prosperous').length / total) * 100,
            mmRatio: mmCount / total
        };
    }).sort((a, b) => b.mmRatio - a.mmRatio);

    const biharData = data.filter(d => d.state === 'Bihar').sort((a, b) => a.mpi_score - b.mpi_score);
    const avgMpiNational = data.reduce((a, b) => a + b.mpi_score, 0) / data.length;
    const avgMpiBihar = biharData.reduce((a, b) => a + b.mpi_score, 0) / biharData.length;

    return { 
        all: data, 
        chart1Data, 
        chart3Data, 
        biharData, 
        avgMpiNational, 
        avgMpiBihar
    };
  }, []);
}
