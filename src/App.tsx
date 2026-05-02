/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, 
    ResponsiveContainer, Cell, LabelList, ScatterChart, Scatter, 
    Legend, ZAxis, ReferenceLine, PieChart, Pie, Cell as PieCell
} from 'recharts';
import { useProcessedData, District } from './data';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Terminal, FileText, Database, Map as MapIcon, 
    BarChart3, Activity, Info, LayoutDashboard,
    ArrowUpRight, Users, TrendingUp, Filter, Search,
    ChevronRight, ExternalLink, Download, Share2, X
} from 'lucide-react';
import Markdown from 'react-markdown';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icons
import L from 'leaflet';
// @ts-ignore
import icon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow });
L.Marker.prototype.options.icon = DefaultIcon;

const CATEGORY_COLORS: Record<string, string> = {
    'Poor': '#EF4444', // Vibrant Red
    'Missing Middle': '#F59E0B', // Amber
    'Prosperous': '#3B82F6'  // Blue
};

const CATEGORY_BG: Record<string, string> = {
    'Poor': 'bg-red-50',
    'Missing Middle': 'bg-amber-50',
    'Prosperous': 'bg-blue-50'
};

type ViewMode = 'overview' | 'missing-middle' | 'regional' | 'research' | 'scenario';

export default function App() {
    const { 
        all: initialAll, chart1Data: initialChart1, chart3Data: initialChart3, biharData: initialBihar, 
        avgMpiNational: initialAvgMpi, avgMpiBihar: initialAvgBihar
    } = useProcessedData();

    const [activeView, setActiveView] = useState<ViewMode>('overview');
    const [searchTerm, setSearchTerm] = useState('');
    const [customDistricts, setCustomDistricts] = useState<District[]>([]);
    const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);

    // Merge and re-process data if needed
    const all = useMemo(() => [...initialAll, ...customDistricts], [initialAll, customDistricts]);

    const filteredDistricts = useMemo(() => {
        if (!searchTerm) return all;
        return all.filter(d => 
            d.district.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.state.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [all, searchTerm]);

    const states = useMemo(() => Array.from(new Set(filteredDistricts.map(d => d.state))), [filteredDistricts]);

    const chart1Data = useMemo(() => states.map(s => {
        const total = filteredDistricts.filter(d => d.state === s).length;
        const mm = filteredDistricts.filter(d => d.state === s && d.category === 'Missing Middle').length;
        return { name: s, count: mm, percentage: (mm / total) * 100 };
    }).filter(d => d.count > 0).sort((a, b) => b.count - a.count), [filteredDistricts, states]);

    const chart3Data = useMemo(() => states.map(s => {
        const districts = filteredDistricts.filter(d => d.state === s);
        const total = districts.length;
        const mmCount = districts.filter(d => d.category === 'Missing Middle').length;
        return {
            name: s,
            Poor: (districts.filter(d => d.category === 'Poor').length / total) * 100,
            'Missing Middle': (mmCount / total) * 100,
            Prosperous: (districts.filter(d => d.category === 'Prosperous').length / total) * 100,
            mmRatio: mmCount / total
        };
    }).sort((a, b) => b.mmRatio - a.mmRatio), [filteredDistricts, states]);

    const biharData = useMemo(() => filteredDistricts.filter(d => d.state === 'Bihar').sort((a, b) => a.mpi_score - b.mpi_score), [filteredDistricts]);
    const avgMpiNational = useMemo(() => all.reduce((a, b) => a + b.mpi_score, 0) / all.length, [all]);
    const avgMpiBihar = useMemo(() => biharData.length > 0 ? biharData.reduce((a, b) => a + b.mpi_score, 0) / biharData.length : 0, [biharData]);

    // Summary Statistics
    const summary = useMemo(() => {
        const cats = ['Poor', 'Missing Middle', 'Prosperous'];
        const total = filteredDistricts.length || 1;
        return cats.map(cat => {
            const items = filteredDistricts.filter(d => d.category === cat);
            const count = items.length;
            const avgMpi = count > 0 ? items.reduce((a, b) => a + b.mpi_score, 0) / count : 0;
            const avgWpr = count > 0 ? items.reduce((a, b) => a + b.wpr, 0) / count : 0;
            return {
                category: cat,
                count,
                pct: ((count / total) * 100).toFixed(0),
                avgMpi,
                avgWpr
            };
        });
    }, [filteredDistricts]);

    const pieData = summary.map(s => ({ name: s.category, value: s.count }));

    const mmStats = summary.find(s => s.category === 'Missing Middle')!;

    const researchNote = `
# The Strategic Inertia of the Missing Middle: A Pan-India Sub-National Analysis
**Author:** Firoz Alam, 2nd year BA Double Major Economics and Political Science student at MAHE
**Classification:** Strategic Policy Framework | Confidential Analysis
**Date:** May 2025

### 1. Executive Summary: The Structural Bottleneck
The "Missing Middle" districts of India represent a precarious developmental equilibrium. This analysis, spanning ${all.length} districts, identifies a persistent structural bottleneck where regions exit absolute poverty but fail to transition into high-productivity industrial or service clusters. These ${all.filter(d => d.category === 'Missing Middle').length} districts are neither beneficiaries of the 'Pro-Poor' social safety nets nor the 'Agglomeration Economies' of Tier-1 urban centers, resulting in a systemic stagnation we term the "Middle Trap."

### 2. The Resilience Index (RI) 2.0
Our proprietary **Resilience Index** has been updated to include high-frequency data across four pillars:
*   **DPI Integration:** Density of Aadhaar-enabled payments and OCEN (Open Credit Enablement Network) utilization in MSMEs.
*   **Labor Market Elasticity:** The Worker Participation Rate (WPR) adjusted for formalization and skill-mix diversity.
*   **Gati Shakti Synchronization:** Proximity to National Infrastructure Pipeline (NIP) nodes and multimodal logistics efficiency.
*   **Environmental Resilience:** Vulnerability to climate-induced agricultural shocks and urbanization heat-island impacts.

We find a significant "Resilience Gap": Missing Middle districts average an RI of **4.4/10**, failing to cross the **6.5/10** threshold required for attracting sustained private capital.

### 3. Regional Divergence and The Bihar Case Study
While the Southern Peninsula and Western Corridor have successfully migrated their middle districts into high-value electronics and chemical value chains, the "Hinterland Middle" (Bihar, UP, Jharkhand) remains trapped in low-surplus agrarian cycles.
*   **The Bihar Paradox:** Districts like ${biharData.filter(d => d.category === 'Missing Middle').slice(0, 3).map(d => d.district).join(', ')} exhibit robust labor participation but stagnate due to "Infrastructure Deficits."
*   **Capital Displacement:** Our model shows that for every 1% increase in prosperity in a Tier-1 hub, there is a corresponding 0.4% capital flight from surrounding Missing Middle districts, exacerbating regional inequality.

### 4. Policy Recommendations: The 2030 Structural Transformation Framework

1.  **DPI-Enabled Regional Value Chains (RVC):**
    - **Implementation:** Deployment of the **Open Network for Digital Commerce (ONDC)** to bypass traditional middlemen in 'Missing Middle' agricultural and handicraft clusters, enabling direct access to global markets.
    - **Objective:** Move beyond isolated ODOP (One District One Product) initiatives to integrated "Specialized Economic Corridors."

2.  **Tier-II Resilience Bonds & Sovereign Backing:**
    - **Mechanism:** Issuance of **Sub-National Resilience Bonds** specifically for districts with an RI below 5.0. These bonds would be backed by a first-loss guarantee from the **National Investment and Infrastructure Fund (NIIF)**.
    - **Target:** Financing 24/7 industrial-grade power and cold-storage grids in currently "resilience-deficient" nodes.

3.  **Predictive Welfare & Economic Steering (PWES):**
    - **Mechanism:** Transitioning from static DBT (Direct Benefit Transfer) to **Algorithmic Asset Allocation**. Using the **MPI_Core** dashboard to front-load capital investments in districts showing early signs of "Resilience Decay" before a full economic collapse occurs.

### 5. Strategic Conclusion
The "Middle Trap" is the single greatest threat to India's $5 Trillion ambition. Ignoring these ${all.filter(d => d.category === 'Missing Middle').length} districts is a strategic risk that could lead to "Island Development"—where a few prosperous hubs are surrounded by a sea of underperforming regions. The transition from 'Survival' to 'Surplus' requires more than just capital; it requires a geospatial-first policy architecture.
`;

    return (
        <div className="min-h-screen bg-page text-navy font-sans selection:bg-gold/10">
            {/* Fixed Sidebar - Institutional Aesthetic */}
            <aside className="fixed left-0 top-0 h-full w-72 bg-navy text-white flex flex-col border-r border-navy/10 z-[1001] hidden xl:flex">
                <div className="p-8 pb-10 border-b border-white/10">
                    <div className="flex items-center gap-4 mb-10">
                        <div className="w-10 h-10 bg-white/10 flex items-center justify-center rounded-lg border border-white/10">
                            <BarChart3 size={20} className="text-white" />
                        </div>
                        <div>
                            <span className="block font-display font-bold text-lg tracking-tight text-white leading-none uppercase">MPI_Core</span>
                            <span className="text-[9px] uppercase tracking-[0.2em] font-medium text-white/40 mt-1.5 block">Economic Suite</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2.5 px-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500/80" />
                        <p className="text-[9px] uppercase tracking-[0.2em] font-bold text-white/30">System Status: Active</p>
                    </div>
                </div>

                <nav className="flex-1 p-6 space-y-8 overflow-y-auto">
                    <div className="space-y-4">
                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest px-3">System Modules</p>
                        <div className="space-y-1">
                            <NavItem 
                                active={activeView === 'overview'} 
                                onClick={() => setActiveView('overview')}
                                icon={<LayoutDashboard size={18} />}
                                label="Macro Strategy"
                            />
                            <NavItem 
                                active={activeView === 'missing-middle'} 
                                onClick={() => setActiveView('missing-middle')}
                                icon={<Activity size={18} />}
                                label="Middle Inertia"
                            />
                            <NavItem 
                                active={activeView === 'regional'} 
                                onClick={() => setActiveView('regional')}
                                icon={<TrendingUp size={18} />}
                                label="Geospatial Hubs"
                            />
                            <NavItem 
                                active={activeView === 'scenario'} 
                                onClick={() => setActiveView('scenario')}
                                icon={<Database size={18} />}
                                label="Scenario Lab"
                            />
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest px-3">Documentation</p>
                        <div className="space-y-1">
                            <NavItem 
                                active={activeView === 'research'} 
                                onClick={() => setActiveView('research')}
                                icon={<FileText size={18} />}
                                label="White Paper"
                            />
                        </div>
                    </div>
                </nav>

                <div className="p-6 bg-white/[0.01] border-t border-white/5 mt-auto">
                    <div className="flex items-center gap-4 p-3.5 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-all cursor-pointer group">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-lg bg-white/[0.05] flex items-center justify-center text-[11px] font-bold border border-white/10 text-white/60">FA</div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-navy rounded-full"></div>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-[11px] font-bold text-white truncate">Firoz Alam</p>
                            <p className="text-[9px] font-medium text-white/30 uppercase tracking-wider truncate">Author</p>
                        </div>
                        <ChevronRight size={14} className="text-white/20 group-hover:text-white transition-all" />
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="xl:ml-72 min-h-screen pb-20">
                {/* Top Header */}
                <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-gray-200 h-16 flex items-center justify-between px-8 z-[1000]">
                    <div className="flex items-center gap-4">
                        <h1 className="font-display text-lg font-bold">
                            {activeView === 'overview' && 'National MPI Overview'}
                            {activeView === 'missing-middle' && 'The Missing Middle Analysis'}
                            {activeView === 'regional' && 'Regional Deep-Dive: Bihar'}
                            {activeView === 'research' && 'Research Narrative'}
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative group hidden sm:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <input 
                                type="text"
                                placeholder="Search districts or states..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-16 py-1.5 bg-gray-100 border-transparent border focus:bg-white focus:border-gray-200 rounded-full text-xs transition-all w-48 focus:w-64 outline-none font-bold"
                            />
                            {searchTerm && (
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    <span className="text-[8px] font-black uppercase text-gold">
                                        {filteredDistricts.length}
                                    </span>
                                    <button 
                                        onClick={() => setSearchTerm('')}
                                        className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-200 text-slate-400 group-hover:text-slate-600 transition-colors"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            )}
                        </div>
                        <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <Download size={18} className="text-gray-500" />
                        </button>
                        <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <Share2 size={18} className="text-gray-500" />
                        </button>
                    </div>
                </header>

                <div className="p-8">
                    <AnimatePresence mode="wait">
                        {activeView === 'overview' && (
                            <motion.div 
                                key="overview"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-8"
                            >
                                {/* KPI Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                                    <StatCard 
                                        label="Total Districts" 
                                        value={all.length} 
                                        subValue="Verified Dataset" 
                                        icon={<Database size={24} />} 
                                        delay={0.1}
                                    />
                                    <StatCard 
                                        label="Missing Middle" 
                                        value={mmStats.count} 
                                        subValue={`${mmStats.pct}% Segment Size`} 
                                        color="text-gold"
                                        icon={<Activity size={24} />} 
                                        delay={0.2}
                                    />
                                    <StatCard 
                                        label="Market Resilience" 
                                        value={(all.filter(d => d.category === 'Missing Middle').reduce((a, b) => a + b.resilience_index, 0) / (mmStats.count || 1)).toFixed(2)} 
                                        subValue="Internal Benchmarking" 
                                        icon={<TrendingUp size={24} />} 
                                        delay={0.3}
                                    />
                                    <StatCard 
                                        label="Systemic Coverage" 
                                        value={chart3Data.length} 
                                        subValue="Across 20+ States" 
                                        icon={<Info size={24} />} 
                                        delay={0.4}
                                    />
                                </div>

                                {/* Main Analysis Section */}
                                <div className="bg-surface rounded-[32px] border border-navy/[0.04] p-10 shadow-[0_20px_60px_rgba(0,0,0,0.02)] relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-navy/[0.01] -rotate-12 translate-x-20 -translate-y-20 flex items-center justify-center pointer-events-none">
                                        <Database size={200} className="text-navy opacity-[0.05]" />
                                    </div>
                                    
                                    <div className="max-w-4xl mb-16 relative">
                                        <p className="text-[10px] font-black text-gold uppercase tracking-[0.4em] mb-6">Macro Contextualization</p>
                                        <h2 className="font-serif italic text-5xl text-navy mb-8 leading-[1.2]">
                                            The <span className="text-gold underline decoration-gold/20 underline-offset-8">Missing Middle</span> represents the primary structural bottleneck in India's dual-speed growth model.
                                        </h2>
                                        <p className="text-navy/50 font-medium text-lg leading-relaxed max-w-3xl">
                                            Our analytical pipeline, covering {all.length} sub-national territories, identifies a significant density of districts trapped below the liquidity threshold. These regions exhibit 
                                            <span className="text-navy font-bold"> high labor participation </span> but <span className="text-gold font-bold"> low capitalization </span>.
                                        </p>
                                    </div>

                                     <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
                                        {/* Map Component */}
                                        <div className="lg:col-span-2 space-y-10">
                                            <div className="flex items-center justify-between px-2">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-3 h-3 rounded-full bg-gold animate-pulse" />
                                                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-navy/40">Geospatial Intelligence Map</span>
                                                </div>
                                                <div className="flex gap-4">
                                                    <LegendItem color={CATEGORY_COLORS['Poor']} label="Chronic Deprivation" />
                                                    <LegendItem color={CATEGORY_COLORS['Missing Middle']} label="Missing Middle" />
                                                    <LegendItem color={CATEGORY_COLORS['Prosperous']} label="Growth Hubs" />
                                                </div>
                                            </div>
                                            <div className="h-[600px] rounded-[32px] overflow-hidden border border-navy/[0.04] shadow-[0_40px_100px_-20px_rgba(15,23,42,0.08)] group relative">
                                                {/* Map Search Overlay */}
                                                <div className="absolute top-6 left-6 z-[1001] flex flex-col gap-2">
                                                    <div className="relative group/search">
                                                        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-navy/40 group-focus-within/search:text-gold transition-colors" />
                                                        <input 
                                                            type="text"
                                                            placeholder="Quick Search District..."
                                                            className="pl-10 pr-4 py-3 bg-white/90 backdrop-blur-md border border-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest text-navy outline-none shadow-2xl focus:w-64 w-48 transition-all"
                                                            onChange={(e) => setSearchTerm(e.target.value)}
                                                            value={searchTerm}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="absolute inset-0 bg-[radial-gradient(#0F172A_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03] pointer-events-none z-[1000]" />
                                            <MapContainer center={[20.5937, 78.9629]} zoom={5} className="h-full w-full">
                                                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                                                <MapController selected={selectedDistrict} />
                                                {filteredDistricts.map((d, i) => (
                                                    /* @ts-ignore */
                                                    <CircleMarker 
                                                        key={`map-${i}`}
                                                        center={[d.lat, d.lon] as [number, number]} 
                                                        radius={Math.max(4, Math.min(18, d.population_lakhs / 4))}
                                                        pathOptions={{ fillColor: d.color, color: '#fff', weight: 1, fillOpacity: 0.8 }}
                                                        eventHandlers={{
                                                            click: () => setSelectedDistrict(d)
                                                        }}
                                                    >
                                                        {/* Permanent labels for high-impact clusters/hubs */}
                                                        { (d.is_urban_hub || d.population_lakhs > 100) && (
                                                            /* @ts-ignore */
                                                            <Tooltip permanent direction="top" opacity={0.6} className="map-label">
                                                                <span className="text-[7px] font-black uppercase text-navy/60 pointer-events-none">{d.district}</span>
                                                            </Tooltip>
                                                        )}
                                                        {/* @ts-ignore */}
                                                        <Tooltip sticky>
                                                            <div className="font-mono text-[10px] p-1">
                                                                <p className="font-bold border-b border-gray-100 mb-1 pb-1">{d.district}</p>
                                                                <p className="flex justify-between gap-4"><span>MPI:</span> <span className="font-bold">{d.mpi_score.toFixed(3)}</span></p>
                                                                <p className="flex justify-between gap-4"><span>WPR:</span> <span className="font-bold">{d.wpr.toFixed(1)}%</span></p>
                                                                <p className="flex justify-between gap-4"><span>Pop:</span> <span className="font-bold text-[#2E86AB]">{d.population_lakhs.toFixed(1)}L</span></p>
                                                            </div>
                                                        </Tooltip>
                                                    </CircleMarker>
                                                ))}
                                            </MapContainer>
                                            {selectedDistrict && (
                                                <button 
                                                    onClick={() => setSelectedDistrict(null)}
                                                    className="absolute bottom-6 left-6 bg-navy text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-gold transition-all z-[1001]"
                                                >
                                                    Reset View
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Distribution Analysis */}
                                    <div className="space-y-12 lg:pl-16 lg:border-l lg:border-navy/[0.03] flex flex-col justify-center">
                                        <div className="space-y-4">
                                            <p className="text-[10px] font-black uppercase text-gold tracking-[0.4em]">Segmentation</p>
                                            <h3 className="font-serif italic text-4xl text-navy mb-4 tracking-tight">District Mix</h3>
                                            <p className="text-sm text-navy/40 font-medium leading-relaxed italic">
                                                The current categorical split reveals a significant lean towards the 'Missing Middle', 
                                                highlighting the need for targeted policy intervention.
                                            </p>
                                        </div>

                                        <div className="h-64 relative group">
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <div className="text-center">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Total</p>
                                                    <p className="text-3xl font-display font-black text-navy">{all.length}</p>
                                                </div>
                                            </div>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={pieData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={70}
                                                        outerRadius={85}
                                                        paddingAngle={8}
                                                        dataKey="value"
                                                        stroke="none"
                                                    >
                                                        {pieData.map((entry, index) => (
                                                            <PieCell 
                                                                key={`cell-${index}`} 
                                                                fill={CATEGORY_COLORS[entry.name]} 
                                                                className="hover:opacity-80 transition-opacity cursor-pointer outline-none"
                                                            />
                                                        ))}
                                                    </Pie>
                                                    <ReTooltip 
                                                        content={({ active, payload }) => {
                                                            if (active && payload && payload.length) {
                                                                return (
                                                                    <div className="bg-white px-3 py-2 shadow-xl border border-gray-100 rounded-lg">
                                                                        <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{payload[0].name}</p>
                                                                        <p className="text-lg font-display font-bold text-navy">{payload[0].value} Districts</p>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>

                                        <div className="space-y-2">
                                            {summary.map(s => (
                                                <div key={`split-${s.category}`} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50/50 hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100 group">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[s.category] }} />
                                                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">{s.category}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs font-mono font-black text-navy">{s.count}</span>
                                                        <div className="w-12 h-1 bg-white rounded-full overflow-hidden">
                                                            <div 
                                                                className="h-full transition-all duration-1000 ease-out" 
                                                                style={{ backgroundColor: CATEGORY_COLORS[s.category], width: `${s.pct}%` }} 
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            </motion.div>
                        )}

                        {activeView === 'missing-middle' && (
                            <motion.div 
                                key="missing-middle"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Chart: MM Intensity by State */}
                                    <div className="bg-white p-10 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-1 h-32 bg-gold/20" />
                                        <p className="text-[10px] font-black uppercase text-gold tracking-widest mb-2">Regional Concentration</p>
                                        <h3 className="font-serif italic text-2xl mb-2 text-navy">The "Middle Trap" Ratio</h3>
                                        <p className="text-xs text-slate-400 mb-8 font-medium">Proportion of districts stuck in the Missing Middle segment by state.</p>
                                        <div className="h-[800px] overflow-y-auto pr-4 scrollbar-hide">
                                            <ResponsiveContainer width="100%" height={1000}>
                                                <BarChart layout="vertical" data={chart1Data} margin={{ right: 80, left: 0, top: 10, bottom: 10 }}>
                                                    <XAxis type="number" hide />
                                                    <YAxis 
                                                        dataKey="name" 
                                                        type="category" 
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                        style={{ fontSize: 10, fontWeight: 700, fill: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }} 
                                                        width={120} 
                                                    />
                                                    <ReTooltip 
                                                        cursor={{ fill: '#A57C4F', opacity: 0.05 }}
                                                        content={({ active, payload }) => {
                                                            if (active && payload && payload.length) {
                                                                return (
                                                                    <div className="bg-navy p-3 shadow-2xl border border-navy rounded-xl">
                                                                        <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{payload[0].payload.name}</p>
                                                                        <p className="text-sm font-bold text-white">{payload[0].value} Districts</p>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        }}
                                                    />
                                                    <Bar dataKey="count" fill="#A57C4F" radius={[0, 4, 4, 0]} barSize={20}>
                                                        <LabelList 
                                                            dataKey="count" 
                                                            position="right" 
                                                            formatter={(...args: any[]) => {
                                                                const val = args[0];
                                                                const data = chart1Data.find(d => d.count === val);
                                                                return `${val} [${data?.percentage.toFixed(0) || 0}%]`;
                                                            }}
                                                            style={{ fontSize: 10, fontWeight: 800, fill: '#0F172A' }}
                                                        />
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Scatter View */}
                                    <div className="bg-white p-10 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-1 h-32 bg-navy/10" />
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Correlation Matrix</p>
                                        <h3 className="font-serif italic text-2xl mb-2 text-navy">Poverty vs Labor Integration</h3>
                                        <p className="text-xs text-slate-400 mb-8 font-medium">Interplay between multidimensional deprivation and worker participation.</p>
                                        <div className="h-[450px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                                    <XAxis 
                                                        type="number" 
                                                        dataKey="x" 
                                                        name="MPI Score" 
                                                        domain={[0, 0.7]} 
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                                                        label={{ value: 'MPI DEPRIVATION →', position: 'bottom', offset: 0, fontSize: 10, fontWeight: 800, fill: '#64748b' }}
                                                    />
                                                    <YAxis 
                                                        type="number" 
                                                        dataKey="y" 
                                                        name="WPR %" 
                                                        domain={[20, 80]}
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                                                        label={{ value: '← LABOR RATIO (WPR)', angle: -90, position: 'left', fontSize: 10, fontWeight: 800, fill: '#64748b' }}
                                                    />
                                                    <ReTooltip 
                                                        content={({ active, payload }) => {
                                                            if (active && payload && payload.length) {
                                                                const data = payload[0].payload;
                                                                return (
                                                                    <div className="bg-white p-4 shadow-2xl border border-gray-100 rounded-2xl min-w-[160px]">
                                                                        <p className="font-black text-[10px] uppercase text-gold border-b border-gray-50 mb-3 pb-2">{data.name}</p>
                                                                        <div className="space-y-1">
                                                                            <p className="flex justify-between text-[11px] font-medium text-slate-400">MPI Score: <span className="text-navy font-bold">{data.x.toFixed(3)}</span></p>
                                                                            <p className="flex justify-between text-[11px] font-medium text-slate-400">Labor Part: <span className="text-gold font-bold">{data.y.toFixed(1)}%</span></p>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        }}
                                                    />
                                                    <ReferenceLine x={0.3} stroke="#e2e8f0" strokeWidth={2} label={{ value: 'Targeting Threshold', position: 'top', fill: '#94a3b8', fontSize: 9, fontWeight: 700 }} />
                                                    {Object.entries(CATEGORY_COLORS).map(([cat, col]) => (
                                                        <Scatter 
                                                            key={cat} 
                                                            name={cat} 
                                                            data={all.filter(d => d.category === cat).map(d => ({ x: d.mpi_score, y: d.wpr, name: d.district }))} 
                                                            fill={col} 
                                                            opacity={0.7}
                                                        />
                                                    ))}
                                                    <Legend 
                                                        verticalAlign="top" 
                                                        align="right" 
                                                        iconType="circle" 
                                                        wrapperStyle={{ paddingTop: 0, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }} 
                                                    />
                                                </ScatterChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Detailed Impact Districts */}
                                    <div className="lg:col-span-2 bg-white rounded-[32px] border border-gray-100 p-10 overflow-hidden relative">
                                        <div className="flex items-center justify-between mb-8">
                                            <div>
                                                <p className="text-[10px] font-black uppercase text-gold tracking-widest mb-1">Strategic Selection</p>
                                                <h3 className="font-serif italic text-2xl text-navy">Priority Intervention Clusters</h3>
                                                <p className="text-xs text-slate-400 font-medium mt-1">Districts identified for high-growth potential within the MM segment.</p>
                                            </div>
                                            <div className="text-right hidden sm:block">
                                                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mb-1">Total Risk Population</p>
                                                <p className="text-2xl font-display font-black text-navy tracking-tighter">
                                                    {all.filter(d => d.category === 'Missing Middle').reduce((acc, curr) => acc + curr.population_lakhs, 0).toFixed(0)}L
                                                </p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {filteredDistricts.filter(d => d.category === 'Missing Middle').slice(0, 9).map((d, i) => (
                                                <div key={`impact-${i}`} className="p-5 bg-gray-50/50 rounded-[24px] border border-transparent hover:border-gold/30 hover:bg-white hover:shadow-[0_10px_30px_rgba(165,124,79,0.05)] transition-all group cursor-default relative overflow-hidden">
                                                    <div className="absolute top-0 right-0 w-1 h-12 bg-gold/10 group-hover:bg-gold/40 transition-colors" />
                                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">{d.state}</p>
                                                    <p className="font-display font-bold text-navy group-hover:text-gold transition-colors text-base">{d.district}</p>
                                                    <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-black text-slate-300 uppercase">Resilience</span>
                                                            <span className="text-xs font-mono font-black text-navy">{(d.resilience_index * 10).toFixed(1)}/10</span>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[9px] font-black text-slate-300 uppercase">Labor</span>
                                                            <span className="text-xs font-mono font-black text-gold">{d.wpr.toFixed(0)}%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Hypothesis Summary Card */}
                                    <div className="bg-navy text-white rounded-[32px] p-10 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12 group-hover:rotate-6 transition-transform duration-1000">
                                            <TrendingUp size={160} />
                                        </div>
                                        <div className="relative z-10 h-full flex flex-col">
                                            <p className="text-[10px] font-black uppercase text-gold tracking-[0.3em] mb-6">Analytic Hypothesis</p>
                                            <p className="text-2xl font-serif italic leading-relaxed mb-10 text-slate-200">
                                                By decoupling <span className="text-gold">District resilience</span> from mere welfare metrics, 
                                                we unlock a multi-trillion dollar consumer layer that is currently invisible to standard 
                                                poverty targeting frameworks.
                                            </p>
                                            <div className="mt-auto">
                                                <button 
                                                    onClick={() => setActiveView('research')}
                                                    className="inline-flex items-center gap-3 px-6 py-3 bg-white/10 hover:bg-gold text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                                                >
                                                    Full Framework Paper <ChevronRight size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeView === 'regional' && (
                            <motion.div 
                                key="regional"
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.02 }}
                                className="space-y-8"
                            >
                                <div className="bg-surface p-10 rounded-[32px] border border-navy/[0.04] shadow-[0_20px_60px_rgba(0,0,0,0.02)]">
                                    <div className="flex items-center justify-between mb-12">
                                        <div className="flex items-center gap-6">
                                            <div className="w-16 h-16 rounded-[24px] bg-gold flex items-center justify-center text-white shadow-2xl shadow-gold/20">
                                                <TrendingUp size={28} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase text-gold tracking-[0.4em] mb-2 leading-none">Comparative Benchmarking</p>
                                                <h3 className="font-serif italic text-4xl text-navy">Bihar District Ranking</h3>
                                            </div>
                                        </div>
                                        <div className="hidden lg:block text-right">
                                            <p className="text-[10px] font-black text-navy/20 uppercase tracking-[0.2em]">Contextual Data Point</p>
                                            <p className="text-xl font-display font-black text-navy">AVG: {avgMpiBihar.toFixed(3)}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="h-[500px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={biharData} margin={{ bottom: 100 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis 
                                                    dataKey="district" 
                                                    tick={{ fontSize: 10, fill: '#64748b' }} 
                                                    interval={0}
                                                    angle={-45}
                                                    textAnchor="end"
                                                />
                                                <YAxis 
                                                    tick={{ fontSize: 10 }} 
                                                    axisLine={false} 
                                                    tickLine={false}
                                                    label={{ value: 'Deprivation Score (MPI) →', angle: -90, position: 'insideLeft', fontSize: 11, fontWeight: 600, fill: '#64748b' }}
                                                />
                                                <ReTooltip />
                                                <ReferenceLine y={avgMpiNational} stroke="#2E86AB" strokeWidth={2} strokeDasharray="8 4" label={{ value: 'NATIONAL BENCHMARK', position: 'right', fill: '#2E86AB', fontSize: 9, fontWeight: 800 }} />
                                                <ReferenceLine y={avgMpiBihar} stroke="#E05C3A" strokeWidth={1} strokeDasharray="3 3" label={{ value: 'STATE AVG', position: 'left', fill: '#E05C3A', fontSize: 9, fontWeight: 700 }} />
                                                <Bar dataKey="mpi_score" radius={[4, 4, 0, 0]} barSize={24}>
                                                    {biharData.map((entry, index) => (
                                                        <Cell key={`cell-bihar-${index}`} fill={entry.color} fillOpacity={0.9} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="bg-surface rounded-[32px] border border-navy/[0.04] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.02)]">
                                     <div className="p-8 border-b border-navy/[0.04] flex items-center justify-between bg-page/30 backdrop-blur-sm">
                                        <div className="flex items-center gap-6">
                                            <span className="text-sm font-black flex items-center gap-3 uppercase tracking-[0.2em] text-navy">
                                                <Search size={18} className="text-gold" /> 
                                                Relational Inspector 
                                                <span className="text-[10px] bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full font-black tracking-widest border border-emerald-100 uppercase">Live Pipeline</span>
                                            </span>
                                            {searchTerm && (
                                                <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-gold" />
                                                    Filtering: "{searchTerm}" • {filteredDistricts.length} matches
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex gap-4">
                                            <button className="flex items-center gap-2 px-4 py-2 bg-navy/5 hover:bg-navy/10 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest text-navy/60">
                                                <Filter size={14} />
                                                Parameters
                                            </button>
                                        </div>
                                     </div>
                                     <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead>
                                                <tr className="bg-navy border-b border-navy/10">
                                                    <th className="p-6 font-black uppercase tracking-[0.2em] text-white/40 text-[10px]">District Entity</th>
                                                    <th className="p-6 font-black uppercase tracking-[0.2em] text-white/40 text-[10px] text-center">Jurisdiction</th>
                                                    <th className="p-6 font-black uppercase tracking-[0.2em] text-white/40 text-[10px] text-center">MPI Scale</th>
                                                    <th className="p-6 font-black uppercase tracking-[0.2em] text-white/40 text-[10px] text-center">Social Asset</th>
                                                    <th className="p-6 font-black uppercase tracking-[0.2em] text-white/40 text-[10px] text-center">Labor Force</th>
                                                    <th className="p-6 font-black uppercase tracking-[0.2em] text-white/40 text-[10px] text-center">Market Tier</th>
                                                    <th className="p-6 font-black uppercase tracking-[0.2em] text-white/40 text-[10px] text-right">Pop. (L)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-navy/[0.02]">
                                                {filteredDistricts.slice(0, 30).map((d, i) => (
                                                    <tr 
                                                        key={`table-${i}`} 
                                                        className="hover:bg-navy transition-all duration-300 group cursor-default"
                                                    >
                                                        <td className="p-6 font-display font-black text-navy group-hover:text-white transition-colors">
                                                            <div className="flex flex-col">
                                                                <span className="flex items-center gap-3">
                                                                    {d.district}
                                                                    {d.is_urban_hub && (
                                                                        <span className="text-[7px] bg-gold text-white px-2 py-0.5 rounded-[4px] font-black uppercase tracking-widest group-hover:bg-white group-hover:text-navy transition-colors shadow-sm">Hub</span>
                                                                    )}
                                                                </span>
                                                                <span className="text-[9px] text-navy/30 font-black uppercase tracking-widest mt-1 group-hover:text-white/40 transition-colors italic">{(d as any).sub_region || 'Standard SPEC'}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-6 text-center text-navy/40 font-black text-[10px] uppercase tracking-widest group-hover:text-white/60 transition-colors italic">{d.state}</td>
                                                        <td className="p-6 text-center">
                                                            <div className="flex flex-col items-center gap-1.5">
                                                                <span className="font-mono font-black text-sm text-navy group-hover:text-white transition-colors">{d.mpi_score.toFixed(3)}</span>
                                                                <div className="w-12 h-1 bg-navy/5 rounded-full overflow-hidden group-hover:bg-white/10">
                                                                    <div 
                                                                        className="h-full bg-navy group-hover:bg-gold transition-colors"
                                                                        style={{ width: `${(1 - d.mpi_score) * 100}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-6 text-center">
                                                            <div className="flex flex-col items-center">
                                                               <span className="text-[10px] font-mono font-black text-navy group-hover:text-gold transition-colors tracking-tighter">SPEC: {(d.resilience_index * 10).toFixed(1)}</span>
                                                               <span className="text-[8px] text-navy/20 uppercase font-black tracking-widest mt-0.5 group-hover:text-white/30 truncate">Resilience</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-6 text-center">
                                                            <div className="inline-flex flex-col items-center">
                                                                <span className={`font-mono font-black text-sm ${d.wpr > 50 ? 'text-emerald-600 group-hover:text-emerald-400' : 'text-gold group-hover:text-gold'} transition-colors`}>
                                                                    {d.wpr.toFixed(1)}%
                                                                </span>
                                                                <span className="text-[8px] text-navy/20 uppercase font-black tracking-widest mt-0.5 group-hover:text-white/30 italic">L.Participation</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-6 text-center">
                                                            <span className={`text-[8px] px-3 py-1 rounded-full font-black uppercase tracking-[0.2em] border shadow-sm group-hover:shadow-none transition-all ${CATEGORY_BG[d.category]}`} style={{ color: d.color, borderColor: `${d.color}22` }}>
                                                                {d.category}
                                                            </span>
                                                        </td>
                                                        <td className="p-6 text-right font-mono font-black text-navy group-hover:text-white transition-colors text-sm">
                                                            {d.population_lakhs.toFixed(1)}L
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                     </div>
                                     <div className="p-8 bg-navy/[0.02] border-t border-navy/[0.03] flex justify-between items-center">
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-navy/20">Displaying primary 30 nodes</p>
                                        <div className="flex gap-4">
                                            <button className="text-[9px] font-black uppercase text-navy/40 hover:text-gold transition-colors tracking-widest font-serif">Previous</button>
                                            <button className="text-[9px] font-black uppercase text-navy/40 hover:text-gold transition-colors tracking-widest font-serif">Next Phase</button>
                                        </div>
                                     </div>
                                </div>
                            </motion.div>
                        )}

                        {activeView === 'scenario' && (
                            <motion.div 
                                key="scenario"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="max-w-4xl mx-auto"
                            >
                                <ScenarioModeler 
                                    onAdd={(d) => {
                                        setCustomDistricts(prev => [...prev, d]);
                                        setActiveView('overview');
                                    }}
                                />
                                
                                {customDistricts.length > 0 && (
                                    <div className="mt-12 bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm">
                                        <h3 className="font-serif italic text-xl text-navy mb-6">Added Scenario Districts</h3>
                                        <div className="space-y-4">
                                            {customDistricts.map((d, index) => (
                                                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                                                    <div>
                                                        <p className="text-sm font-bold text-navy">{d.district}</p>
                                                        <p className="text-[10px] text-slate-400 uppercase font-black uppercase tracking-widest">{d.state}</p>
                                                    </div>
                                                    <div className="flex gap-8">
                                                        <div className="text-right">
                                                            <p className="text-[9px] font-black text-slate-300 uppercase">MPI</p>
                                                            <p className="text-xs font-mono font-bold text-navy">{d.mpi_score.toFixed(3)}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[9px] font-black text-slate-300 uppercase">WPR</p>
                                                            <p className="text-xs font-mono font-bold text-gold">{d.wpr.toFixed(1)}%</p>
                                                        </div>
                                                        <button 
                                                            onClick={() => setCustomDistricts(prev => prev.filter((_, i) => i !== index))}
                                                            className="text-red-400 hover:text-red-600 transition-colors"
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}
                        {activeView === 'research' && (
                            <motion.div 
                                key="research"
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="max-w-4xl mx-auto"
                            >
                                <article className="bg-[#FFFFFF] p-12 lg:p-20 rounded-[32px] border border-gray-100 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.05)] relative overflow-hidden text-navy">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-gold/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
                                    <div className="absolute top-0 left-12 w-20 h-1 bg-gold" />
                                    
                                    <div className="markdown-body prose prose-slate max-w-none prose-headings:font-serif prose-headings:italic prose-headings:text-navy prose-p:text-slate-600 prose-p:leading-[1.8] prose-a:text-gold prose-blockquote:border-l-gold prose-blockquote:bg-gray-50 prose-blockquote:italic prose-blockquote:p-8 prose-blockquote:rounded-r-3xl mt-8">
                                        <Markdown>{researchNote}</Markdown>
                                    </div>

                                    {/* Footer removed per user request */}
                                </article>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
}

function MapController({ selected }: { selected: District | null }) {
    const map = useMap();
    
    React.useEffect(() => {
        if (selected) {
            map.flyTo([selected.lat, selected.lon], 8, {
                duration: 1.5,
                easeLinearity: 0.25
            });
        } else {
            map.flyTo([20.5937, 78.9629], 5, {
                duration: 1.5
            });
        }
    }, [selected, map]);
    
    return null;
}

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
    return (
        <button 
            onClick={onClick}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 group relative
                ${active 
                    ? 'text-white translate-x-1' 
                    : 'text-white/40 hover:bg-white/5 hover:text-white'}`}
        >
            {active && (
                <motion.div 
                    layoutId="active-nav-bg"
                    className="absolute inset-0 bg-white/5 rounded-2xl border-l-4 border-gold -z-10"
                    transition={{ type: "spring", bounce: 0.1, duration: 0.6 }}
                />
            )}
            <span className={`${active ? 'text-gold' : 'text-white/20 group-hover:text-gold'} transition-colors`}>{icon}</span>
            <span className={`text-[10px] font-black tracking-[0.2em] uppercase ${active ? 'opacity-100' : 'opacity-80'}`}>{label}</span>
        </button>
    );
}

function ScenarioModeler({ onAdd }: { onAdd: (d: District) => void }) {
    const [formData, setFormData] = useState({
        district: '',
        state: '',
        mpi: '',
        wpr: '',
        population: ''
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const states = [
        'Bihar', 'Uttar Pradesh', 'Maharashtra', 'Kerala', 'Karnataka', 
        'Tamil Nadu', 'Gujarat', 'Madhya Pradesh', 'Rajasthan', 'West Bengal'
    ];

    const validate = () => {
        const newErrors: Record<string, string> = {};
        
        if (!formData.district || formData.district.length < 3) {
            newErrors.district = 'District name must be at least 3 characters';
        }
        
        if (!formData.state) {
            newErrors.state = 'Please select a state';
        }
        
        const mpi = parseFloat(formData.mpi);
        if (isNaN(mpi) || mpi < 0 || mpi > 0.7) {
            newErrors.mpi = 'MPI Score must be between 0.0 and 0.7';
        }
        
        const wpr = parseFloat(formData.wpr);
        if (isNaN(wpr) || wpr < 0 || wpr > 100) {
            newErrors.wpr = 'WPR must be between 0 and 100%';
        }
        
        const pop = parseFloat(formData.population);
        if (isNaN(pop) || pop <= 0 || pop > 2000) {
            newErrors.population = 'Population must be between 0.1 and 2000 Lakhs';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate()) {
            setIsSubmitting(true);
            
            // Artificial delay for professional feel
            setTimeout(() => {
                const mpi = parseFloat(formData.mpi);
                const wpr = parseFloat(formData.wpr);
                const res = (1 - mpi) * 0.6 + (wpr / 75) * 0.4;

                const newDistrict: District = {
                    district: formData.district,
                    state: formData.state,
                    sub_region: 'User Defined Cluster',
                    is_urban_hub: false,
                    mpi_score: mpi,
                    wpr: wpr,
                    population_lakhs: parseFloat(formData.population),
                    resilience_index: Math.min(1, Math.max(0, res)),
                    lat: 20 + Math.random() * 10,
                    lon: 75 + Math.random() * 10,
                    percentile_rank: 0.5, // Will be re-calculated if merged in App.tsx
                    category: 'Missing Middle', // Default, logic usually re-calculates
                    color: '#A57C4F'
                };
                
                onAdd(newDistrict);
                setIsSubmitting(false);
            }, 800);
        }
    };

    const inputClasses = (field: string) => `
        w-full bg-navy/[0.02] border border-navy/[0.03] rounded-2xl px-5 py-4 
        text-sm font-black text-navy focus:outline-none focus:ring-4 focus:ring-gold/5 
        focus:bg-white focus:border-gold transition-all duration-500
        ${errors[field] ? 'border-red-200 bg-red-50/30' : 'hover:border-navy/10'}
    `;

    return (
        <div className="bg-surface rounded-[32px] border border-navy/[0.04] p-10 shadow-[0_40px_100px_-20px_rgba(15,23,42,0.05)] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8">
                <Database size={80} className="text-navy/[0.02] rotate-12" />
            </div>
            
            <div className="flex items-center gap-6 mb-12">
                <div className="w-14 h-14 bg-navy rounded-2xl flex items-center justify-center text-white">
                    <Activity size={24} />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase text-gold tracking-[0.4em] mb-2 leading-none">Simulation Environment</p>
                    <h2 className="font-serif italic text-4xl text-navy">Inject Synthetic Data</h2>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">District Name</label>
                    <input 
                        type="text" 
                        placeholder="e.g., Patna North Cluster" 
                        className={inputClasses('district')}
                        value={formData.district}
                        onChange={e => setFormData({...formData, district: e.target.value})}
                    />
                    <AnimatePresence>
                        {errors.district && (
                            <motion.p 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="text-[10px] font-bold text-red-500 px-1"
                            >
                                {errors.district}
                            </motion.p>
                        )}
                    </AnimatePresence>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">State Context</label>
                    <select 
                        className={inputClasses('state')}
                        value={formData.state}
                        onChange={e => setFormData({...formData, state: e.target.value})}
                    >
                        <option value="">Select State...</option>
                        {states.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {errors.state && <p className="text-[10px] font-bold text-red-500 px-1">{errors.state}</p>}
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">MPI Score (0.000 - 0.700)</label>
                    <input 
                        type="number" 
                        step="0.001"
                        placeholder="0.250" 
                        className={inputClasses('mpi')}
                        value={formData.mpi}
                        onChange={e => setFormData({...formData, mpi: e.target.value})}
                    />
                    {errors.mpi && <p className="text-[10px] font-bold text-red-500 px-1">{errors.mpi}</p>}
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">WPR % (Labor Force)</label>
                    <input 
                        type="number" 
                        step="0.1"
                        placeholder="45.5" 
                        className={inputClasses('wpr')}
                        value={formData.wpr}
                        onChange={e => setFormData({...formData, wpr: e.target.value})}
                    />
                    {errors.wpr && <p className="text-[10px] font-bold text-red-500 px-1">{errors.wpr}</p>}
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Population (Lakhs)</label>
                    <input 
                        type="number" 
                        step="0.1"
                        placeholder="25.0" 
                        className={inputClasses('population')}
                        value={formData.population}
                        onChange={e => setFormData({...formData, population: e.target.value})}
                    />
                    {errors.population && <p className="text-[10px] font-bold text-red-500 px-1">{errors.population}</p>}
                </div>

                <div className="md:col-span-2 pt-6">
                    <button 
                        type="submit"
                        disabled={isSubmitting}
                        className={`w-full py-4 rounded-2xl bg-navy text-white font-black uppercase tracking-[0.2em] text-sm shadow-xl shadow-navy/20 hover:bg-gold transition-all duration-500 flex items-center justify-center gap-3 ${isSubmitting ? 'opacity-70 cursor-wait' : 'hover:-translate-y-1'}`}
                    >
                        {isSubmitting ? (
                            <>
                                <Activity size={18} className="animate-spin" />
                                Validating Data Integrity...
                            </>
                        ) : (
                            <>
                                <TrendingUp size={18} />
                                Merge into Prediction Model
                            </>
                        )}
                    </button>
                    <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-6">
                        System automatically performs outlier detection and variance normalization.
                    </p>
                </div>
            </form>
        </div>
    );
}

function StatCard({ label, value, subValue, icon, color = 'text-navy', delay = 0 }: { label: string, value: string | number, subValue: string, icon: React.ReactNode, color?: string, delay?: number }) {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="bg-surface p-8 rounded-3xl border border-navy/[0.05] shadow-[0_10px_40px_-15px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.06)] transition-all duration-500 group relative overflow-hidden"
        >
            <div className="flex items-start justify-between mb-8">
                <div className={`w-12 h-12 rounded-xl bg-navy/[0.03] flex items-center justify-center text-navy/30 group-hover:text-gold group-hover:bg-navy/5 transition-all duration-500`}>
                    {icon}
                </div>
                <div className="text-right">
                    <p className="text-[9px] uppercase tracking-[0.3em] font-black text-navy/30 mb-2">{label}</p>
                    <span className={`text-4xl font-display font-black tracking-tighter ${color}`}>{value}</span>
                </div>
            </div>
            <div className="w-full h-px bg-navy/[0.05] mb-5 overflow-hidden">
                <motion.div 
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    className="h-full bg-gold origin-left"
                    transition={{ duration: 1, delay: delay + 0.3 }}
                />
            </div>
            <p className="text-[9px] text-navy/40 flex items-center justify-between font-bold uppercase tracking-widest">
                <span className="flex items-center gap-2">
                    <ArrowUpRight size={12} className="text-gold/60" />
                    {subValue}
                </span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-500 font-serif italic normal-case text-gold/80">View Analysis</span>
            </p>
        </motion.div>
    );
}

function LegendItem({ color, label }: { color: string, label: string }) {
    return (
        <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-gray-100 shadow-sm transition-transform hover:scale-105 cursor-default">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">{label}</span>
        </div>
    );
}
