import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';
// Sample data
const data = [{
  name: 'Mon',
  revenue: 1200
}, {
  name: 'Tue',
  revenue: 1900
}, {
  name: 'Wed',
  revenue: 1600
}, {
  name: 'Thu',
  revenue: 2200
}, {
  name: 'Fri',
  revenue: 2800
}, {
  name: 'Sat',
  revenue: 1500
}, {
  name: 'Sun',
  revenue: 500
}];
export const RevenueChart: React.FC = () => {
  const {
    darkMode
  } = useTheme();
  return <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{
        top: 5,
        right: 20,
        left: 10,
        bottom: 5
      }}>
          <CartesianGrid strokeDasharray="3 3" stroke={darkMode  '#334155' : '#e2e8f0'} />
          <XAxis dataKey="name" tick={{
          fill: darkMode  '#cbd5e1' : '#64748b'
        }} axisLine={{
          stroke: darkMode  '#334155' : '#e2e8f0'
        }} />
          <YAxis tick={{
          fill: darkMode  '#cbd5e1' : '#64748b'
        }} axisLine={{
          stroke: darkMode  '#334155' : '#e2e8f0'
        }} tickFormatter={value => `$${value}`} />
          <Tooltip contentStyle={{
          backgroundColor: darkMode  '#1e293b' : '#ffffff',
          borderColor: darkMode  '#334155' : '#e2e8f0',
          color: darkMode  '#f8fafc' : '#1e293b'
        }} formatter={value => [`$${value}`, 'Revenue']} />
          <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} dot={{
          fill: '#3b82f6',
          r: 4
        }} activeDot={{
          fill: '#2563eb',
          r: 6,
          strokeWidth: 2
        }} />
        </LineChart>
      </ResponsiveContainer>
    </div>;
};