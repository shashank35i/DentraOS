import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
// Sample data
const data = [{
  name: 'Dental Materials',
  value: 35
}, {
  name: 'Instruments',
  value: 25
}, {
  name: 'Disposables',
  value: 20
}, {
  name: 'Medications',
  value: 15
}, {
  name: 'Office Supplies',
  value: 5
}];
const COLORS = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe'];
export const InventoryPieChart: React.FC = () => {
  return <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value" label={({
          name,
          percent
        }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
            {data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={value => `${value}%`} />
        </PieChart>
      </ResponsiveContainer>
    </div>;
};