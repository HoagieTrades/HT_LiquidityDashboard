import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // You can keep this or delete it, doesn't matter much

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);