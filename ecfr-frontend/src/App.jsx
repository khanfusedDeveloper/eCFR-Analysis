import { useState, useEffect } from 'react';
import { fetchAgencies, fetchAgencyMetrics } from './api';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import './App.css';

function App() {
  const [agencies, setAgencies] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(false);

  // 1. Fetch the list of agencies when the app loads
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

  // 2. Fetch the metrics whenever the selected agency changes
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
          {/* TOP CARDS: Current Data */}
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
                <p className="metric-value checksum">{latestMetric.checksum.substring(0, 16)}...</p>
                <span className="metric-label">Used to detect unannounced text changes</span>
              </div>
            </div>
          ) : (
            <div className="no-data">No metrics available for this agency yet.</div>
          )}

          {/* BOTTOM SECTION: Historical Chart */}
          {metrics.length > 0 && (
            <div className="chart-section">
              <h2>Historical Trends</h2>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={metrics} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    {/* Format the date nicely for the X-Axis */}
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(tick) => tick.split('T')[0]} 
                    />
                    <YAxis yAxisId="left" tickFormatter={(tick) => tick.toLocaleString()} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(tick) => tick.toLocaleString()} />
                    <Tooltip labelFormatter={(label) => label.split('T')[0]} />
                    <Legend />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="word_count" 
                      name="Total Word Count" 
                      stroke="#2563eb" 
                      strokeWidth={3} 
                      activeDot={{ r: 8 }} 
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="restrictive_word_count" 
                      name="Restrictive Words" 
                      stroke="#dc2626" 
                      strokeWidth={3} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;