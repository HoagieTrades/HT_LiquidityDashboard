import React, { useEffect, useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

// --- UTILS ---
const formatCurrency = (value) => {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}T`;
  return `$${value.toFixed(0)}B`;
};

// --- CHART COMPONENT ---
const DashboardChart = ({ title, data, color, height = '350px' }) => {
  if (!data || data.length === 0) return null;
  
  const values = data.map(d => parseFloat(d.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = (max - min) * 0.05;

  // SMART DOTS LOGIC:
  // If we have fewer than 60 points (e.g., 30 days or 1 week), show the big bubbles.
  // If we have more (e.g., 1 Year), hide them so it doesn't look gross.
  const showDots = data.length < 60;

  return (
    <div style={{ 
      height: height, 
      backgroundColor: '#161b22', 
      padding: '20px', 
      borderRadius: '8px', 
      border: '1px solid #30363d',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <h3 style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#c9d1d9', fontWeight: 600 }}>{title}</h3>
      
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
            <XAxis 
              dataKey="date" 
              stroke="#8b949e" 
              tick={{fill: '#8b949e', fontSize: 11}}
              minTickGap={50}
              tickFormatter={(str) => {
                const date = new Date(str);
                return `${date.getMonth() + 1}/${date.getDate()}`;
              }}
            />
            <YAxis 
              domain={[min - padding, max + padding]} 
              stroke="#8b949e"
              tick={{fill: '#8b949e', fontSize: 11}} 
              width={45}
              tickFormatter={formatCurrency} 
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0d1117', borderColor: '#30363d', color: '#fff' }}
              itemStyle={{ color: color }}
              labelFormatter={(label) => new Date(label).toLocaleDateString()}
              formatter={(value) => [`$${value} Billion`, "Value"]}
            />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={color} 
              strokeWidth={2} 
              // CONDITIONAL DOTS
              dot={showDots ? { r: 4, fill: color, stroke: '#000000', strokeWidth: 2 } : false}
              activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// --- MAIN APP ---
const App = () => {
  const [fullData, setFullData] = useState(null);
  const [filteredData, setFilteredData] = useState(null);
  const [meta, setMeta] = useState(null);

  // Controls
  const [timeRange, setTimeRange] = useState('30d');
  const [viewMode, setViewMode] = useState('grid');
  
  // Custom Date
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // 1. Fetch
  useEffect(() => {
    fetch('./data.json')
      .then(res => res.json())
      .then(rawData => {
        const format = (arr) => arr.map(item => ({ date: item[0], value: item[1] }));
        setMeta(rawData.meta);
        setFullData({
          formula1: format(rawData.formula_1),
          fedAssets: format(rawData.fed_assets),
          tga: format(rawData.tga),
          rrp: format(rawData.rrp),
          loansFacilities: format(rawData.loans_facilities),
          loansHeld: format(rawData.loans_held),
        });
      })
      .catch(err => console.error("Error fetching data:", err));
  }, []);

  // 2. Filter
  useEffect(() => {
    if (!fullData) return;

    const now = new Date();
    let startDate = new Date();
    let endDate = new Date(); 

    if (timeRange === 'custom' && customStart) {
       startDate = new Date(customStart);
       if (customEnd) endDate = new Date(customEnd);
    } else {
      switch (timeRange) {
        case '1w':  startDate.setDate(now.getDate() - 7); break;
        case '2w':  startDate.setDate(now.getDate() - 14); break;
        case '30d': startDate.setDate(now.getDate() - 30); break;
        case '3m':  startDate.setMonth(now.getMonth() - 3); break;
        case '6m':  startDate.setMonth(now.getMonth() - 6); break;
        case '1y':  startDate.setFullYear(now.getFullYear() - 1); break;
        case 'all': startDate = new Date('2000-01-01'); break;
        default:    startDate.setDate(now.getDate() - 30);
      }
    }

    const filter = (arr) => arr ? arr.filter(item => {
      const d = new Date(item.date);
      return d >= startDate && d <= endDate;
    }) : [];

    setFilteredData({
      formula1: filter(fullData.formula1),
      fedAssets: filter(fullData.fedAssets),
      tga: filter(fullData.tga),
      rrp: filter(fullData.rrp),
      loansFacilities: filter(fullData.loansFacilities),
      loansHeld: filter(fullData.loansHeld),
    });

  }, [fullData, timeRange, customStart, customEnd]);

  if (!filteredData) return <div style={{padding: 50, color: 'white'}}>Loading Dashboard...</div>;

  const buttonStyle = (isActive) => ({
    padding: '6px 12px',
    backgroundColor: isActive ? '#1f6feb' : '#21262d',
    color: isActive ? '#ffffff' : '#c9d1d9',
    border: '1px solid #30363d',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '12px',
    transition: 'all 0.2s'
  });

  const inputStyle = {
    backgroundColor: '#0d1117',
    border: '1px solid #30363d',
    color: 'white',
    padding: '5px',
    borderRadius: '4px',
    colorScheme: 'dark' 
  };

  return (
    <div style={{ 
      backgroundColor: '#0d1117', 
      minHeight: '100vh', 
      padding: '20px', 
      color: 'white',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' 
    }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        
        {/* Header Controls */}
        <div style={{ 
          marginBottom: '20px', 
          borderBottom: '1px solid #30363d', 
          paddingBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'end',
          flexWrap: 'wrap',
          gap: '20px'
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px' }}>Net Fed Liquidity</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '5px' }}>
              <p style={{ color: '#8b949e', margin: 0, fontSize: '13px' }}>
                Formula #1: Assets - TGA - RRP + Loans
              </p>
              {meta?.last_updated && (
                <span style={{ 
                  backgroundColor: '#238636', 
                  color: 'white', 
                  fontSize: '11px', 
                  padding: '2px 8px', 
                  borderRadius: '12px',
                  fontWeight: 600 
                }}>
                  Last Updated: {meta.last_updated}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
            {/* Top Row: Quick Selects */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['1w', '2w', '30d', '3m', '6m', '1y', 'all'].map(range => (
                <button 
                  key={range} 
                  onClick={() => { setTimeRange(range); }} 
                  style={buttonStyle(timeRange === range)}
                >
                  {range.toUpperCase()}
                </button>
              ))}
              <button 
                onClick={() => setViewMode(viewMode === 'grid' ? 'full' : 'grid')} 
                style={{...buttonStyle(false), marginLeft: '10px'}}
              >
                {viewMode === 'grid' ? '☰ List' : '⊞ Grid'}
              </button>
            </div>

            {/* Bottom Row: Custom Date Range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#21262d', padding: '5px 10px', borderRadius: '6px' }}>
              <span style={{ fontSize: '12px', color: '#8b949e' }}>Custom:</span>
              <input 
                type="date" 
                style={inputStyle} 
                onChange={(e) => { setCustomStart(e.target.value); setTimeRange('custom'); }} 
              />
              <span style={{ color: '#8b949e' }}>-</span>
              <input 
                type="date" 
                style={inputStyle} 
                onChange={(e) => { setCustomEnd(e.target.value); setTimeRange('custom'); }} 
              />
            </div>
          </div>
        </div>

        {/* Charts */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: viewMode === 'grid' ? '1fr 1fr' : '1fr', 
          gap: '20px' 
        }}>
          
          <DashboardChart title="Formula #1 (Net Liquidity)" data={filteredData.formula1} color="#a371f7" unit="B" />
          <DashboardChart title="Treasury General Account (TGA)" data={filteredData.tga} color="#3fb950" unit="B" />
          <DashboardChart title="Total Assets (WALCL)" data={filteredData.fedAssets} color="#f85149" unit="B" />
          <DashboardChart title="Reverse Repo (RRP)" data={filteredData.rrp} color="#f0883e" unit="B" />
          <DashboardChart title="Liquidity Facilities (H41...)" data={filteredData.loansFacilities} color="#58a6ff" unit="B" />
          <DashboardChart title="Loans Held (WLCFLL)" data={filteredData.loansHeld} color="#d29922" unit="B" />
          
        </div>

        {/* Footer */}
        <div style={{ 
          marginTop: '40px', 
          paddingTop: '20px', 
          borderTop: '1px solid #30363d', 
          textAlign: 'center',
          color: '#8b949e',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          Product of <span style={{ color: '#58a6ff' }}>Hoagie_Trades</span>
        </div>

      </div>
    </div>
  );
};

export default App;