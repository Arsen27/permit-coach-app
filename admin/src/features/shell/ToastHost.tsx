import React from 'react';
import styled from 'styled-components';

import { useUi } from '@admin/store/uiStore';

const ToastHost: React.FC = () => {
  const toast = useUi(state => state.toast);
  return toast.length === 0 ? null : <Pill>{toast}</Pill>;
};

export default ToastHost;

const Pill = styled.div`
  position: fixed;
  left: 50%;
  bottom: 26px;
  transform: translateX(-50%);
  background: #18181b;
  color: #fff;
  font-size: 12.5px;
  font-weight: 600;
  padding: 10px 17px;
  border-radius: 99px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  z-index: 60;
  animation: toast-in 0.25s ease;
`;
