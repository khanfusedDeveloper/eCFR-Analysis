import { useState, useEffect } from 'react';
import { fetchAgencies, fetchAgencyMetrics } from './api';
import { 
  AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import './App.css';

function App() {
  const [agencies, setAgencies] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadAgencies = async () => {
      const data = await fetchAgencies();
      setAgencies(data);
      if (data.length > 0) {
        setSelectedSlug(data[0].slug); 
      }
    };
    loadAgencies();
  }, []);

  useEffect(() => {
    const loadMetrics = async () => {
      if (!selectedSlug) return;
      setLoading(true);
      const data = await fetchAgencyMetrics(selectedSlug);
      setMetrics(data);
      setLoading(false);
    };
    loadMetrics();
  }, [selectedSlug]);

  const latestMetric = metrics.length > 0 ? metrics[metrics.length - 1] : null;

  // Calculate data specifically for the Pie Chart based on the latest metric
  const pieData = latestMetric ? [
    { name: 'Restrictive Words', value: latestMetric.restrictive_word_count },
    { name: 'Standard Words', value: latestMetric.word_count - latestMetric.restrictive_word_count }
  ] : [];
  
  const PIE_COLORS = ['#dc2626', '#2563eb']; // Red for restrictive, Blue for standard word count

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>eCFR Deregulation Analysis Dashboard</h1>
        <p>Analyze federal regulations, word counts, and restrictive language over time.</p>
      </header>

      <div className="controls-section">
        <label htmlFor="agency-select"><strong>Select an Agency:</strong></label>
        <select 
          id="agency-select" 
          value={selectedSlug} 
          onChange={(e) => setSelectedSlug(e.target.value)}
        >
          {agencies.map((agency) => (
            <option key={agency.slug} value={agency.slug}>
              {agency.name} {agency.short_name ? `(${agency.short_name})` : ''}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loading">Loading agency data...</div>
      ) : (
        <>
          {latestMetric ? (
            <div className="metrics-grid">
              <div className="metric-card">
                <h3>Total Word Count</h3>
                <p className="metric-value">{latestMetric.word_count.toLocaleString()}</p>
                <span className="metric-label">As of {latestMetric.date.split('T')[0]}</span>
              </div>
              <div className="metric-card">
                <h3>Restrictive Words</h3>
                <p className="metric-value">{latestMetric.restrictive_word_count.toLocaleString()}</p>
                <span className="metric-label">"shall", "must", "required", etc.</span>
              </div>
              <div className="metric-card checksum-card">
                <h3>Latest Checksum (SHA-256)</h3>
                <p className="metric-value checksum">{latestMetric.checksum}</p>
                <span className="metric-label">Used to detect unannounced text changes</span>
              </div>
            </div>
          ) : (
            <div className="no-data">
              Did you start the PostgreSQL database? Go into the ecfr-backend folder and run: <strong>node server.js</strong>
            </div>
          )}

          {metrics.length > 0 && (
            <div className="charts-wrapper" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginTop: '2rem' }}>
              
              {/* PIE CHART: Current Snapshot */}
              <div className="chart-section" style={{ flex: '1', minWidth: '300px' }}>
                <h2>Current Composition</h2>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => value.toLocaleString()} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* AREA CHART: Historical Trend */}
              <div className="chart-section" style={{ flex: '2', minWidth: '500px' }}>
                <h2>Historical Volume</h2>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={metrics} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis dataKey="date" tickFormatter={(tick) => tick.split('T')[0]} />
                      <YAxis tickFormatter={(tick) => tick.toLocaleString()} />
                      <Tooltip labelFormatter={(label) => label.split('T')[0]} />
                      <Legend />
                      <Area type="monotone" dataKey="word_count" name="Total Word Count" stroke="#2563eb" fill="#2563eb" fillOpacity={0.3} />
                      <Area type="monotone" dataKey="restrictive_word_count" name="Restrictive Words" stroke="#dc2626" fill="#dc2626" fillOpacity={0.8} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;