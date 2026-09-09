import React, { useState } from 'react';
import styled from 'styled-components';

import { PrimaryButton } from '@admin/features/shell/ui';
import { useAuth } from '@admin/store/authStore';
import { admin } from '@admin/styles/theme';

// The panel's front door. Supabase mode signs in with e-mail and password —
// the server then checks the allowlist; the shared admin token remains as the
// fallback for setups without Supabase auth.

const LoginScreen: React.FC = () => {
  const config = useAuth(state => state.config);
  const busy = useAuth(state => state.busy);
  const error = useAuth(state => state.error);
  const login = useAuth(state => state.login);
  const useToken = useAuth(state => state.useToken);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [tokenMode, setTokenMode] = useState(config?.mode === 'token');

  const supabase = config?.mode === 'supabase' && !tokenMode;

  const submit = () => {
    if (supabase) {
      void login(email.trim(), password);
    } else if (token.trim().length > 0) {
      useToken(token.trim());
    }
  };

  return (
    <Wrap>
      <Card
        onKeyDown={event => {
          if (event.key === 'Enter') {
            submit();
          }
        }}
      >
        <Logo>
          <LogoRing />
        </Logo>
        <Title>PermitCoach · Content Admin</Title>
        <Sub>
          {supabase
            ? 'Sign in with an allow-listed account.'
            : 'Present the admin token to continue.'}
        </Sub>

        {supabase ? (
          <>
            <Field
              autoFocus
              type="email"
              placeholder="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
            />
            <Field
              type="password"
              placeholder="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
            />
          </>
        ) : (
          <Field
            autoFocus
            type="password"
            placeholder="admin token"
            value={token}
            onChange={event => setToken(event.target.value)}
          />
        )}

        {error != null && <Error>{error}</Error>}

        <PrimaryButton
          disabled={
            busy || (supabase ? email.length === 0 : token.length === 0)
          }
          onClick={submit}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </PrimaryButton>

        {config?.mode === 'supabase' && config.tokenFallback && (
          <Switch onClick={() => setTokenMode(value => !value)}>
            {tokenMode
              ? 'Sign in with e-mail instead'
              : 'Use the admin token instead'}
          </Switch>
        )}
      </Card>
    </Wrap>
  );
};

export default LoginScreen;

const Wrap = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${admin.bg};
`;

const Card = styled.div`
  width: 340px;
  background: ${admin.surface};
  border: 1px solid ${admin.line3};
  border-radius: 16px;
  padding: 28px 26px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Logo = styled.div`
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: ${admin.accent};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const LogoRing = styled.div`
  width: 12px;
  height: 12px;
  border-radius: 99px;
  border: 3px solid #fff;
  box-sizing: border-box;
`;

const Title = styled.h1`
  margin: 6px 0 0;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.2px;
`;

const Sub = styled.p`
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.5;
  font-weight: 500;
  color: ${admin.dim};
`;

const Field = styled.input`
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  color: ${admin.ink};
  border: 1px solid ${admin.line};
  border-radius: 10px;
  padding: 10px 12px;
  outline: none;

  &:focus {
    border-color: ${admin.accent};
  }
`;

const Error = styled.p`
  margin: 0;
  font-size: 11.5px;
  font-weight: 600;
  color: #b91c1c;
`;

const Switch = styled.button`
  margin-top: 2px;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 700;
  color: ${admin.accent};
  cursor: pointer;
  align-self: flex-start;
  padding: 0;
`;
