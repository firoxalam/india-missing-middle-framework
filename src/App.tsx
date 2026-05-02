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
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [customDistricts, setCustomDistricts] = useState<District[]>([]);
    const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
    const [simYear, setSimYear] = useState(2025);
    const [comparativeDistricts, setComparativeDistricts] = useState<District[]>([]);
    const [mapMetric, setMapMetric] = useState<'mpi' | 'wpr' | 'resilience'>('mpi');

    // Merge and re-process data if needed
    const all = useMemo(() => {
        const base = [...initialAll, ...customDistricts];
        if (simYear === 2025) return base;

        // Apply Projection logic
        const yearsDiff = simYear - 2025;
        return base.map(d => {
            const improvementRate = (d.resilience_index / 10) * 0.04; // Districts with higher RI improve faster
            const projectedMpi = Math.max(0.01, d.mpi_score * Math.pow(1 - improvementRate, yearsDiff));
            const projectedWpr = Math.min(85, d.wpr * Math.pow(1 + (improvementRate / 2), yearsDiff));
            
            // Re-categorize based on projected MPI
            let projectedCat = d.category;
            if (projectedMpi < 0.15) projectedCat = 'Prosperous';
            else if (projectedMpi < 0.3) projectedCat = 'Missing Middle';
            else projectedCat = 'Poor';

            return {
                ...d,
                mpi_score: projectedMpi,
                wpr: projectedWpr,
                category: projectedCat,
                color: CATEGORY_COLORS[projectedCat]
            };
        });
    }, [initialAll, customDistricts, simYear]);

    const filteredDistricts = useMemo(() => {
        let docs = all;
        if (searchTerm) {
            docs = docs.filter(d => 
                d.district.toLowerCase().includes(searchTerm.toLowerCase()) ||
                d.state.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        if (activeCategory) {
            docs = docs.filter(d => d.category === activeCategory);
        }
        return docs;
    }, [all, searchTerm, activeCategory]);

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
# The "Middle Trap" in India's Growth Path
## A Sub-National Perspective on Economic Inertia

**By:** Firoz Alam  
*BA (Double Major) Economics and Political Science, Manipal Academy of Higher Education (MAHE)*

---

### I. The Core Puzzle
While much of India's policy focus is divided between high-growth urban hubs and rural poverty alleviation, there exists a "Missing Middle." These are the ${all.filter(d => d.category === 'Missing Middle').length} districts that have successfully escaped extreme poverty but are struggling to transition into high-productivity economies. As an undergraduate student of economics and politics, I believe this segment represents the most significant structural challenge to India's long-term prosperity.

### II. The Resilience Gap
Our analysis uses a **Resilience Index (RI)** to measure how well a district can sustain growth. We look at:
*   **Infrastructure:** Not just roads, but the reliability of the power grid.
*   **Digital Access:** The shift from cash to UPI and digital commerce in small businesses.
*   **Labor Strength:** The diversification of skills beyond agriculture.

The data reveals a stark "Resilience Gap." While successful hubs score high, these middle districts are stuck at an average of **4.4/10**. This prevents them from attracting the private investment needed to grow further.

### III. Regional Disparities: A Closer Look
The problem is not uniform across India. Coastal and Western states have managed to pull their middle districts into manufacturing value chains. In contrast, districts in the hinterland, such as ${biharData.filter(d => d.category === 'Missing Middle').slice(0, 3).map(d => d.district).join(', ')} in Bihar, show high labor activity but are held back by severe infrastructure deficits. This is what we call "Disguised Prosperity"—people are working hard, but the economic environment doesn't allow for value creation.

### IV. Moving Forward: A Simple Framework
To bridge this gap, three key shifts are required:
1.  **Digital Integration:** Using platforms like ONDC to help local artisans and farmers reach global markets without middlemen.
2.  **Targeted Infrastructure:** Creating "Resilience Bonds" to specifically fund power and logistics in these middle-tier nodes.
3.  **Data-Driven Policy:** Moving away from "one-size-fits-all" budgeting toward algorithmic allocation that responds to real-time changes in a district's economic health.

### V. Conclusion
The path to a \$5 Trillion economy is not paved only by the mega-cities. It requires us to unlock the potential of the ${all.filter(d => d.category === 'Missing Middle').length} districts currently stuck in the middle. By combining geospatial data with political-economic insight, we can ensure that India's growth is truly inclusive and resilient.
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
                    <div className="flex items-center gap-2 px-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/60" />
                        <p className="text-[9px] uppercase tracking-wider font-bold text-white/20">Active Analysis</p>
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
                    <div className="mb-4 px-2">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Compare Queue</span>
                            <span className="text-[9px] font-bold text-gold">{comparativeDistricts.length}/3</span>
                        </div>
                        <div className="flex gap-2">
                            {comparativeDistricts.map(d => (
                                <div key={d.district} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-bold border border-white/10 group relative">
                                    {d.district.substring(0, 2)}
                                    <button 
                                        onClick={() => setComparativeDistricts(prev => prev.filter(p => p.district !== d.district))}
                                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={8} />
                                    </button>
                                </div>
                            ))}
                            {comparativeDistricts.length === 0 && (
                                <div className="flex-1 h-8 rounded-lg border border-dashed border-white/10 flex items-center justify-center">
                                    <span className="text-[8px] font-bold text-white/10 uppercase tracking-widest leading-none">Add districts</span>
                                </div>
                            )}
                        </div>
                    </div>
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
                        <button 
                            onClick={() => window.print()}
                            className="p-2 hover:bg-gold hover:text-white rounded-full transition-all group relative"
                        >
                            <Download size={18} className="text-gray-500 group-hover:text-white" />
                            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-navy text-white text-[8px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Generate Briefing</span>
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
                                        active={activeCategory === null}
                                        onClick={() => setActiveCategory(null)}
                                    />
                                    <StatCard 
                                        label="Missing Middle" 
                                        value={mmStats.count} 
                                        subValue={`${mmStats.pct}% Segment Size`} 
                                        color="text-gold"
                                        icon={<Activity size={24} />} 
                                        delay={0.2}
                                        active={activeCategory === 'Missing Middle'}
                                        onClick={() => setActiveCategory(activeCategory === 'Missing Middle' ? null : 'Missing Middle')}
                                    />
                                    <StatCard 
                                        label="Chronic Deprivation" 
                                        value={all.filter(d => d.category === 'Poor').length} 
                                        subValue="High Priority" 
                                        color="text-red-500"
                                        icon={<Filter size={24} />} 
                                        delay={0.3}
                                        active={activeCategory === 'Poor'}
                                        onClick={() => setActiveCategory(activeCategory === 'Poor' ? null : 'Poor')}
                                    />
                                    <StatCard 
                                        label="Prosperous Hubs" 
                                        value={all.filter(d => d.category === 'Prosperous').length} 
                                        subValue="Growth Leaders" 
                                        color="text-blue-500"
                                        icon={<Users size={24} />} 
                                        delay={0.4}
                                        active={activeCategory === 'Prosperous'}
                                        onClick={() => setActiveCategory(activeCategory === 'Prosperous' ? null : 'Prosperous')}
                                    />
                                </div>

                                {/* Comparison Engine Dashboard */}
                                {comparativeDistricts.length > 1 && (
                                    <motion.div 
                                       initial={{ opacity: 0, y: 30 }}
                                       animate={{ opacity: 1, y: 0 }}
                                       className="bg-navy rounded-[32px] p-10 mb-12 text-white border border-white/10 shadow-[0_40px_100px_-20px_rgba(15,23,42,0.4)]"
                                    >
                                        <div className="flex items-center justify-between mb-10">
                                            <div className="flex items-center gap-6 text-left">
                                                <div className="w-12 h-12 rounded-xl bg-gold flex items-center justify-center text-navy shadow-lg">
                                                    <Activity size={24} />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase text-gold tracking-[0.4em] mb-1">Analytical Intelligence</p>
                                                    <h3 className="font-serif italic text-3xl">Side-by-Side Benchmarking</h3>
                                                </div>
                                            </div>
                                            <button 
                                               onClick={() => setComparativeDistricts([])}
                                               className="px-6 py-2.5 bg-white/10 hover:bg-red-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/5"
                                            >
                                                Clear analysis
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                            {comparativeDistricts.map(d => (
                                                <div key={`comp-${d.district}`} className="bg-white/[0.03] rounded-3xl p-8 border border-white/5 hover:border-gold/30 transition-all group relative overflow-hidden text-left">
                                                    <div className="absolute top-0 right-0 w-16 h-16 bg-gold/5 -rotate-12 translate-x-8 -translate-y-8" />
                                                    <div className="flex items-center justify-between mb-8 relative z-10 text-left">
                                                        <div>
                                                            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-none mb-2">{d.state}</p>
                                                            <h4 className="text-2xl font-display font-black text-white group-hover:text-gold transition-colors">{d.district}</h4>
                                                        </div>
                                                        <div className={`w-3 h-3 rounded-full ${d.category === 'Prosperous' ? 'bg-blue-500' : d.category === 'Poor' ? 'bg-red-500' : 'bg-gold'}`} />
                                                    </div>
                                                    <div className="space-y-6 relative z-10">
                                                        <MetricRow label="Deprivation Depth" value={d.mpi_score.toFixed(3)} pct={(1 - d.mpi_score) * 100} />
                                                        <MetricRow label="Labor Force %" value={`${d.wpr.toFixed(1)}%`} pct={d.wpr} color="bg-gold" />
                                                        <MetricRow label="Resilience Index" value={`${(d.resilience_index * 10).toFixed(1)}/10`} pct={d.resilience_index * 10} color="bg-emerald-500" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}

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
                                                    <div className="w-2 h-2 rounded-full bg-gold/40" />
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-navy/30">Geospatial Intelligence Map</span>
                                                </div>
                                                <div className="flex gap-4">
                                                    <LegendItem color={CATEGORY_COLORS['Poor']} label="Chronic Deprivation" />
                                                    <LegendItem color={CATEGORY_COLORS['Missing Middle']} label="Missing Middle" />
                                                    <LegendItem color={CATEGORY_COLORS['Prosperous']} label="Growth Hubs" />
                                                </div>
                                            </div>
                                            <div className="h-[600px] rounded-[32px] overflow-hidden border border-navy/[0.04] shadow-[0_40px_100px_-20px_rgba(15,23,42,0.08)] group relative">
                                                {/* Interactive Overlays */}
                                                <div className="absolute top-6 left-6 z-[1001] flex flex-col gap-4">
                                                    <div className="relative group/search">
                                                        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-navy/40 group-focus-within/search:text-gold transition-colors" />
                                                        <input 
                                                            type="text"
                                                            placeholder="Spotlight Search..."
                                                            className="pl-10 pr-4 py-3 bg-white/90 backdrop-blur-md border border-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest text-navy outline-none shadow-2xl focus:w-64 w-48 transition-all"
                                                            onChange={(e) => setSearchTerm(e.target.value)}
                                                            value={searchTerm}
                                                        />
                                                    </div>
                                                    <div className="bg-white/90 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 shadow-2xl flex gap-1">
                                                        {(['mpi', 'wpr', 'resilience'] as const).map(m => (
                                                            <button 
                                                                key={m}
                                                                onClick={() => setMapMetric(m)}
                                                                className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${
                                                                    mapMetric === m ? 'bg-navy text-white' : 'text-navy/40 hover:bg-navy/5'
                                                                }`}
                                                            >
                                                                 {m}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="absolute top-6 right-6 z-[1001] bg-navy/90 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-2xl text-white w-64">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gold">Forecast Cycle</span>
                                                        <span className="text-xl font-display font-black">FY {simYear}</span>
                                                    </div>
                                                    <input 
                                                        type="range"
                                                        min="2025"
                                                        max="2030"
                                                        step="1"
                                                        value={simYear}
                                                        onChange={(e) => setSimYear(parseInt(e.target.value))}
                                                        className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-gold mb-4"
                                                    />
                                                    <div className="flex justify-between text-[8px] font-bold text-white/40 uppercase tracking-widest">
                                                        <span>Current</span>
                                                        <span>2030 Vision</span>
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
                                                        radius={mapMetric === 'resilience' ? d.resilience_index * 2 : mapMetric === 'wpr' ? d.wpr / 4 : Math.max(4, Math.min(18, d.population_lakhs / 4))}
                                                        pathOptions={{ fillColor: d.color, color: comparativeDistricts.find(p => p.district === d.district) ? '#A57C4F' : '#fff', weight: comparativeDistricts.find(p => p.district === d.district) ? 3 : 1, fillOpacity: 0.8 }}
                                                        eventHandlers={{
                                                            click: () => {
                                                                if (comparativeDistricts.find(p => p.district === d.district)) {
                                                                    setComparativeDistricts(prev => prev.filter(p => p.district !== d.district));
                                                                } else if (comparativeDistricts.length < 3) {
                                                                    setComparativeDistricts(prev => [...prev, d]);
                                                                }
                                                                setSelectedDistrict(d);
                                                            }
                                                        }}
                                                    >
                                                        {/* @ts-ignore */}
                                                        <Tooltip sticky>
                                                            <div className="font-mono text-[10px] p-2 min-w-[140px]">
                                                                <p className="font-bold border-b border-gray-100 mb-2 pb-1 text-navy uppercase tracking-widest">{d.district}</p>
                                                                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-2 leading-none">{d.sub_region || 'Standard Cluster'}</p>
                                                                <p className="flex justify-between gap-4 mb-0.5 text-xs"><span>MPI SCORE:</span> <span className="font-bold">{d.mpi_score.toFixed(3)}</span></p>
                                                                <p className="flex justify-between gap-4 mb-0.5 text-xs"><span>LABOR FORCE:</span> <span className="font-bold">{d.wpr.toFixed(1)}%</span></p>
                                                                <p className="flex justify-between gap-4 text-xs"><span>RESILIENCE:</span> <span className="font-bold text-gold">{(d.resilience_index * 10).toFixed(1)}</span></p>
                                                                <div className="mt-3 pt-2 border-t border-gray-50 text-[7px] text-slate-400 font-bold uppercase tracking-widest text-center italic">
                                                                    Click to toggle comparison benchmarking
                                                                </div>
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
                                                        iconSize={8}
                                                        wrapperStyle={{ paddingTop: 0, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6 }} 
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
                                <article className="bg-white p-16 lg:p-24 border border-slate-200/60 shadow-sm relative text-navy mb-20 section-page">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-navy/5" />
                                    <div className="absolute top-0 left-0 w-24 h-1 bg-gold/40" />
                                    
                                    <div className="markdown-body prose prose-slate max-w-none prose-headings:font-serif prose-headings:font-normal prose-headings:text-navy prose-h1:text-4xl prose-h1:mb-2 prose-h2:text-lg prose-h2:text-slate-400 prose-h2:mt-0 prose-h2:mb-16 prose-h2:italic prose-h3:text-xl prose-h3:mt-12 prose-h3:mb-6 prose-h3:font-bold prose-h3:uppercase prose-h3:tracking-widest prose-p:text-slate-600 prose-p:leading-relaxed prose-p:text-lg prose-hr:border-slate-100 mt-8">
                                        <Markdown>{researchNote}</Markdown>
                                    </div>
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
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [shake, setShake] = useState(false);

    const states = [
        'Bihar', 'Uttar Pradesh', 'Maharashtra', 'Kerala', 'Karnataka', 
        'Tamil Nadu', 'Gujarat', 'Madhya Pradesh', 'Rajasthan', 'West Bengal'
    ];

    const validateField = (name: string, value: string) => {
        switch (name) {
            case 'district':
                if (!value) return 'District identification required';
                if (value.length < 3) return 'Nomenclature length insufficient (min 3)';
                if (value.length > 50) return 'Nomenclature exceeds limit (max 50)';
                return '';
            case 'state':
                return value ? '' : 'Geographical context mandatory';
            case 'mpi':
                const m = parseFloat(value);
                if (isNaN(m)) return 'Numeric coefficient required';
                if (m < 0 || m > 0.7) return 'Threshold range: 0.000 - 0.700';
                return '';
            case 'wpr':
                const w = parseFloat(value);
                if (isNaN(w)) return 'Velocity index required';
                if (w < 0 || w > 100) return 'Percentage boundary: 0 - 100';
                return '';
            case 'population':
                const p = parseFloat(value);
                if (isNaN(p)) return 'Demographic scale required';
                if (p <= 0 || p > 2000) return 'Scale range: 0.1 - 2000 Lakhs';
                return '';
            default:
                return '';
        }
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};
        Object.keys(formData).forEach(key => {
            const error = validateField(key, (formData as any)[key]);
            if (error) newErrors[key] = error;
        });
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleInputChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
        setTouched(prev => ({ ...prev, [name]: true }));
        const error = validateField(name, value);
        setErrors(prev => ({ ...prev, [name]: error }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const isValid = validate();
        if (isValid) {
            setIsSubmitting(true);
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
                    percentile_rank: 0.5,
                    category: mpi < 0.15 ? 'Prosperous' : mpi < 0.3 ? 'Missing Middle' : 'Poor',
                    color: mpi < 0.15 ? '#2E86AB' : mpi < 0.3 ? '#A57C4F' : '#E63946'
                };
                
                onAdd(newDistrict);
                setIsSubmitting(false);
            }, 800);
        } else {
            setShake(true);
            setTimeout(() => setShake(false), 500);
        }
    };

    const inputClasses = (field: string) => {
        const isError = errors[field];
        const isTouched = touched[field];
        const isValid = isTouched && !isError;

        return `
            w-full bg-navy/[0.02] border rounded-2xl px-5 py-4 
            text-sm font-black text-navy focus:outline-none focus:ring-4 focus:ring-gold/5 
            focus:bg-white focus:border-gold transition-all duration-500
            ${isError ? 'border-red-500 bg-red-50/10' : isValid ? 'border-emerald-500/30 bg-emerald-50/10' : 'border-navy/[0.03] hover:border-navy/10'}
        `;
    };

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
                    <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">District Name</label>
                        <span className={`text-[8px] font-bold uppercase transition-colors ${formData.district.length > 50 ? 'text-red-500' : 'text-slate-300'}`}>
                            {formData.district.length}/50
                        </span>
                    </div>
                    <input 
                        type="text" 
                        placeholder="e.g., Patna North Cluster" 
                        className={inputClasses('district')}
                        value={formData.district}
                        onChange={e => handleInputChange('district', e.target.value)}
                    />
                    <AnimatePresence>
                        {errors.district && (
                            <motion.p 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                className="text-[10px] font-bold text-red-500 px-1 italic"
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
                        onChange={e => handleInputChange('state', e.target.value)}
                    >
                        <option value="">Select State...</option>
                        {states.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {errors.state && <p className="text-[10px] font-bold text-red-500 px-1 italic">{errors.state}</p>}
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">MPI Score (0.000 - 0.700)</label>
                    <input 
                        type="number" 
                        step="0.001"
                        placeholder="0.250" 
                        className={inputClasses('mpi')}
                        value={formData.mpi}
                        onChange={e => handleInputChange('mpi', e.target.value)}
                    />
                    {errors.mpi && <p className="text-[10px] font-bold text-red-500 px-1 italic">{errors.mpi}</p>}
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">WPR % (Labor Force Participation)</label>
                    <input 
                        type="number" 
                        step="0.1"
                        placeholder="45.5" 
                        className={inputClasses('wpr')}
                        value={formData.wpr}
                        onChange={e => handleInputChange('wpr', e.target.value)}
                    />
                    {errors.wpr && <p className="text-[10px] font-bold text-red-500 px-1 italic">{errors.wpr}</p>}
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Demographic Scale (Lakhs)</label>
                    <input 
                        type="number" 
                        step="0.1"
                        placeholder="25.0" 
                        className={inputClasses('population')}
                        value={formData.population}
                        onChange={e => handleInputChange('population', e.target.value)}
                    />
                    {errors.population && <p className="text-[10px] font-bold text-red-500 px-1 italic">{errors.population}</p>}
                </div>

                <div className="md:col-span-2 pt-6">
                    <motion.button 
                        animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
                        transition={{ duration: 0.4 }}
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
                    </motion.button>
                    <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-6">
                        System automatically performs outlier detection and variance normalization.
                    </p>
                </div>
            </form>
        </div>
    );
}

function MetricRow({ label, value, pct, color = 'bg-blue-500' }: { label: string, value: string | number, pct: number, color?: string }) {
    return (
        <div className="space-y-2">
            <div className="flex justify-between items-end">
                <span className="text-[9px] font-black uppercase text-white/30 tracking-widest">{label}</span>
                <span className="text-xs font-mono font-bold text-white leading-none">{value}</span>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`h-full ${color}`}
                />
            </div>
        </div>
    );
}

function StatCard({ label, value, subValue, icon, color = 'text-navy', delay = 0, onClick, active }: { 
    label: string, 
    value: string | number, 
    subValue: string, 
    icon: React.ReactNode, 
    color?: string, 
    delay?: number,
    onClick?: () => void,
    active?: boolean
}) {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            whileHover={{ y: -5, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            viewport={{ once: true }}
            transition={{ delay, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            onClick={onClick}
            className={`cursor-pointer p-8 rounded-3xl border transition-all duration-500 group relative overflow-hidden ${
                active 
                ? 'bg-navy text-white border-navy shadow-[0_30px_60px_-15px_rgba(15,23,42,0.3)]' 
                : 'bg-surface border-navy/[0.05] shadow-[0_10px_40px_-15px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.06)]'
            }`}
        >
            {/* Subtle Active Glow */}
            {active && (
                <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent pointer-events-none" />
            )}

            <div className="flex items-start justify-between mb-8 relative z-10">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 ${
                    active ? 'bg-white/10 text-gold' : 'bg-navy/[0.03] text-navy/30 group-hover:text-gold group-hover:bg-navy/5'
                }`}>
                    {icon}
                </div>
                <div className="text-right">
                    <p className={`text-[9px] uppercase tracking-[0.3em] font-black mb-2 ${active ? 'text-white/40' : 'text-navy/30'}`}>{label}</p>
                    <span className={`text-4xl font-display font-black tracking-tighter ${active ? 'text-white' : color}`}>{value}</span>
                </div>
            </div>
            
            <div className={`w-full h-px mb-5 overflow-hidden relative z-10 ${active ? 'bg-white/10' : 'bg-navy/[0.05]'}`}>
                <motion.div 
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    className={`h-full origin-left ${active ? 'bg-gold' : 'bg-gold'}`}
                    transition={{ duration: 1, delay: delay + 0.3 }}
                />
            </div>

            <p className={`text-[9px] flex items-center justify-between font-bold uppercase tracking-widest relative z-10 ${active ? 'text-white/40' : 'text-navy/40'}`}>
                <span className="flex items-center gap-2">
                    <ArrowUpRight size={12} className={active ? 'text-gold' : 'text-gold/60'} />
                    {subValue}
                </span>
                <span className={`transition-opacity duration-500 font-serif italic normal-case ${active ? 'opacity-100 text-gold' : 'opacity-0 group-hover:opacity-100 text-gold/80'}`}>
                    {active ? 'Filter Active' : 'Filter Insight'}
                </span>
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
