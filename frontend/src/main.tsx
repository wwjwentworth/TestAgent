import '@ant-design/v5-patch-for-react-19';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ConfigProvider, theme } from 'antd';
import 'antd/dist/reset.css';
import './styles/index.less';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorPrimary: '#5177ef', colorBgElevated: '#101a2d', colorText: '#e8edf8', colorBorder: '#2a3954', borderRadius: 9 } }}>
      <App />
    </ConfigProvider>
  </StrictMode>
);
