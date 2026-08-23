import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styled, { useTheme } from 'styled-components/native';

import { PostHogMaskView } from 'posthog-react-native';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';

import { AuthResult, useAuth } from '@/auth/AuthProvider';
import BrandLogo from '@/components/BrandLogo';
import Icon from '@/components/Icon';
import PrimaryButton from '@/components/PrimaryButton';
import { RootNavigation, RootStackParamList } from '@/navigation/types';

type Mode = 'signUp' | 'signIn';

type Flow = 'register' | 'reset';

// Seconds before a new code may be requested. Supabase enforces its own
// per-user window server-side; this keeps the learner from spending taps
// discovering it.
const RESEND_COOLDOWN = 45;

// Must equal Supabase's "Email OTP length" (Authentication → Sign In /
// Providers → Email). Too low and the field caps before the code is finished;
// too high and the button never enables — either way the code is unusable.
const CODE_LENGTH = 6;

type SecureFieldProps = React.ComponentProps<typeof Field> & {
  placeholder: string;
  value: string;
};

// iOS renders the placeholder of a secureTextEntry input in the system font,
// ignoring the family every other field uses — next to them it reads as loose,
// spaced-out text. There is no placeholder-style prop to correct it, so this
// draws the placeholder itself and leaves the native one empty.
const SecureField: React.FC<SecureFieldProps> = ({
  placeholder,
  value,
  ...props
}) => (
  <SecureWrap>
    {/* The drawn placeholder is invisible to VoiceOver, so the label the
        native one would have carried has to be stated outright. */}
    <Field
      {...props}
      value={value}
      secureTextEntry
      accessibilityLabel={placeholder}
    />
    {value.length === 0 && (
      <PlaceholderLayer pointerEvents="none">
        <PlaceholderText>{placeholder}</PlaceholderText>
      </PlaceholderLayer>
    )}
  </SecureWrap>
);

const AuthScreen: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'Auth'>>();
  const {
    supabaseEnabled,
    appleAvailable,
    googleAvailable,
    registerWithEmail,
    confirmEmailCode,
    resendEmailCode,
    sendPasswordReset,
    confirmPasswordReset,
    signInWithEmail,
    signInWithApple,
    signInWithGoogle,
  } = useAuth();

  const [mode, setMode] = useState<Mode>(route.params?.mode ?? 'signUp');
  // The form collects the details; 'verify' waits on the emailed code. The
  // password stays in state across the two — the server only accepts it once
  // the address behind it is confirmed.
  const [step, setStep] = useState<'form' | 'verify'>('form');
  // Which errand the code screen is running. Both end the same way (prove the
  // address, then set the password), so they share the step.
  const [flow, setFlow] = useState<Flow>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Typed on the code screen when resetting, so a wrong password left in the
  // login form never leaks into the replacement.
  const [newPassword, setNewPassword] = useState('');
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Guards the auto-submit that fires on the last digit against a tap on
  // Verify landing in the same moment.
  const submitting = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = setInterval(
      () => setCooldown(seconds => Math.max(0, seconds - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [cooldown]);

  const finish = (result: AuthResult) => {
    if (result.ok) {
      navigation.goBack();
    } else {
      setError(result.message);
      // An existing account is the most common "sign up" failure — steer to
      // signing in instead. Only from the form: on the code screen the same
      // wording would mean something else entirely.
      if (
        step === 'form' &&
        mode === 'signUp' &&
        /already|exists/i.test(result.message)
      ) {
        setMode('signIn');
      }
    }
  };

  // Every network action funnels through here: one busy flag, one re-entry
  // guard, errors cleared on the way in.
  const run = async (action: () => Promise<AuthResult>) => {
    if (submitting.current) {
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    finish(await action());
    submitting.current = false;
    setBusy(false);
  };

  const startRegistration = async () => {
    if (submitting.current) {
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await registerWithEmail({
      email: email.trim(),
      password,
      name: name.trim(),
    });
    submitting.current = false;
    setBusy(false);
    if (!result.ok) {
      finish(result);
      return;
    }
    // A project with email confirmation off has already finished the job.
    if (!result.needsVerification) {
      navigation.goBack();
      return;
    }
    setCode('');
    setFlow('register');
    setCooldown(RESEND_COOLDOWN);
    setStep('verify');
  };

  const startReset = async () => {
    const trimmed = email.trim();
    if (trimmed.length === 0) {
      setError('Enter your email first, then tap Forgot password.');
      return;
    }
    if (submitting.current) {
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await sendPasswordReset(trimmed);
    submitting.current = false;
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setCode('');
    setNewPassword('');
    setFlow('reset');
    setCooldown(RESEND_COOLDOWN);
    setStep('verify');
  };

  const submitEmail = () => {
    const trimmed = email.trim();
    if (trimmed.length === 0 || password.length === 0) {
      setError('Enter your email and a password.');
      return;
    }
    if (mode === 'signIn') {
      run(() => signInWithEmail(trimmed, password));
      return;
    }
    if (name.trim().length === 0) {
      setError('Enter your name.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    startRegistration();
  };

  const submitCode = (value: string) => {
    if (value.length < CODE_LENGTH) {
      setError(`Enter the ${CODE_LENGTH}-digit code from your email.`);
      return;
    }
    const trimmed = email.trim();
    if (flow === 'register') {
      run(() => confirmEmailCode({ email: trimmed, password, code: value }));
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    run(() =>
      confirmPasswordReset({
        email: trimmed,
        password: newPassword,
        code: value,
      }),
    );
  };

  const changeCode = (value: string) => {
    const digits = value.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    // The number pad has no return key, so a full-length code submits
    // itself — but only when it is the last thing missing. Resetting still
    // needs the new password below it.
    if (flow === 'register' && digits.length === CODE_LENGTH && !busy) {
      submitCode(digits);
    }
  };

  const resend = async () => {
    if (busy || cooldown > 0 || submitting.current) {
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    const result =
      flow === 'register'
        ? await resendEmailCode({ email: email.trim(), name: name.trim() })
        : await sendPasswordReset(email.trim());
    submitting.current = false;
    setBusy(false);
    if (result.ok) {
      setCode('');
      setCooldown(RESEND_COOLDOWN);
      setNotice('A new code is on its way.');
    } else {
      setError(result.message);
    }
  };

  const backToForm = () => {
    setError(null);
    setNotice(null);
    setStep('form');
    setCode('');
  };

  const switchMode = () => {
    backToForm();
    setFlow('register');
    setMode(mode === 'signUp' ? 'signIn' : 'signUp');
  };

  return (
    <Screen
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ paddingBottom: insets.bottom + 22 }}
    >
      <TopBar>
        <CloseButton onPress={() => navigation.goBack()} hitSlop={10}>
          <Icon name="xmark" size={15} color={theme.colors.muted} />
        </CloseButton>
      </TopBar>

      {step === 'verify' ? (
        <Body>
          <Title>
            {flow === 'register' ? 'Confirm your email' : 'Reset your password'}
          </Title>
          <Subtitle>
            {flow === 'register'
              ? `We sent a ${CODE_LENGTH}-digit code to ${email.trim()}. Enter it to finish creating your account.`
              : `If ${email.trim()} has an account, a ${CODE_LENGTH}-digit code is on its way. Enter it and choose a new password.`}
          </Subtitle>

          <MaskedFields>
            <CodeField
              placeholder={'—'.repeat(CODE_LENGTH)}
              placeholderTextColor={theme.colors.dim2}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={CODE_LENGTH}
              autoFocus
              value={code}
              onChangeText={changeCode}
              editable={!busy}
            />
            {flow === 'reset' && (
              <SecureField
                placeholder="New password"
                autoCapitalize="none"
                autoComplete="new-password"
                value={newPassword}
                onChangeText={setNewPassword}
                editable={!busy}
                onSubmitEditing={() => submitCode(code)}
              />
            )}
          </MaskedFields>

          {notice != null && <NoticeText>{notice}</NoticeText>}
          {error != null && <ErrorText>{error}</ErrorText>}

          <View style={{ marginTop: 6 }}>
            <PrimaryButton
              label={flow === 'register' ? 'Verify' : 'Set new password'}
              onPress={() => submitCode(code)}
              disabled={busy || code.length < CODE_LENGTH}
            />
          </View>

          <SwitchRow>
            <Pressable
              onPress={resend}
              disabled={busy || cooldown > 0}
              hitSlop={8}
            >
              <SwitchLink $muted={cooldown > 0}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </SwitchLink>
            </Pressable>
          </SwitchRow>

          <SwitchRow>
            {/* The address is the one thing a code cannot fix — a typo here
                means every resend goes to the same wrong inbox. */}
            <Pressable onPress={backToForm} hitSlop={8}>
              <SwitchText>Use a different email</SwitchText>
            </Pressable>
          </SwitchRow>
        </Body>
      ) : (
        <Body>
          <Title>
            {mode === 'signUp' ? 'Create your account' : 'Welcome back'}
          </Title>
          <Subtitle>
            {mode === 'signUp'
              ? 'Your progress on this device carries over and syncs everywhere you sign in.'
              : 'Sign in to pick up your progress on this device.'}
          </Subtitle>

          {!supabaseEnabled && (
            <ErrorText>
              Accounts aren't configured in this build yet — add the Supabase
              credentials to src/lib/supabaseConfig.ts.
            </ErrorText>
          )}

          {/* Session replay masks text inputs anyway; masking the group
              outright means a future field here cannot leak credentials by
              omission. */}
          <MaskedFields>
            {mode === 'signUp' && (
              <Field
                placeholder="Name"
                placeholderTextColor={theme.colors.dim2}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                value={name}
                onChangeText={setName}
                editable={!busy}
              />
            )}
            <Field
              placeholder="Email"
              placeholderTextColor={theme.colors.dim2}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              editable={!busy}
            />
            <SecureField
              placeholder="Password"
              autoCapitalize="none"
              autoComplete={
                mode === 'signUp' ? 'new-password' : 'current-password'
              }
              value={password}
              onChangeText={setPassword}
              editable={!busy}
              onSubmitEditing={submitEmail}
            />
          </MaskedFields>

          {error != null && <ErrorText>{error}</ErrorText>}

          <View style={{ marginTop: 6 }}>
            <PrimaryButton
              label={mode === 'signUp' ? 'Sign up' : 'Log in'}
              onPress={submitEmail}
              disabled={busy || !supabaseEnabled}
            />
          </View>

          {mode === 'signIn' && (
            <SwitchRow>
              <Pressable onPress={startReset} disabled={busy} hitSlop={8}>
                <SwitchLink>Forgot password?</SwitchLink>
              </Pressable>
            </SwitchRow>
          )}

          {(appleAvailable || googleAvailable) && (
            <>
              <DividerRow>
                <DividerLine />
                <DividerText>or</DividerText>
                <DividerLine />
              </DividerRow>
              {appleAvailable && (
                <ProviderButton
                  disabled={busy}
                  onPress={() => run(signInWithApple)}
                >
                  {/* A touch larger than Google's: the Apple mark carries more
                      empty space inside its viewBox, so it reads smaller. */}
                  <BrandLogo name="apple" size={18} />
                  <ProviderLabel>Continue with Apple</ProviderLabel>
                </ProviderButton>
              )}
              {googleAvailable && (
                <ProviderButton
                  disabled={busy}
                  onPress={() => run(signInWithGoogle)}
                >
                  <BrandLogo name="google" size={17} />
                  <ProviderLabel>Continue with Google</ProviderLabel>
                </ProviderButton>
              )}
            </>
          )}

          <SwitchRow>
            <SwitchText>
              {mode === 'signUp'
                ? 'Already have an account?'
                : "Don't have an account?"}
            </SwitchText>
            <Pressable onPress={switchMode} hitSlop={8}>
              <SwitchLink>
                {mode === 'signUp' ? 'Log in' : 'Sign up'}
              </SwitchLink>
            </Pressable>
          </SwitchRow>
        </Body>
      )}
    </Screen>
  );
};

const Screen = styled(KeyboardAvoidingView)`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.bg};
`;

const TopBar = styled.View`
  flex-direction: row;
  justify-content: flex-end;
  padding: 18px 22px 0;
`;

const CloseButton = styled.Pressable`
  width: 32px;
  height: 32px;
  border-radius: 9999px;
  background-color: ${({ theme }) => theme.colors.faint};
  align-items: center;
  justify-content: center;
`;

const Body = styled.View`
  flex: 1;
  padding: 10px 22px 0;
  gap: 12px;
`;

const Title = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 26px;
  letter-spacing: -0.8px;
  color: ${({ theme }) => theme.colors.ink};
`;

const Subtitle = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  font-size: 14px;
  line-height: 20px;
  color: ${({ theme }) => theme.colors.muted};
  margin-bottom: 8px;
`;

// Hidden from session replay. It is a plain View underneath, so it re-creates
// the 12px gap the Body flow gives its other children.
const MaskedFields = styled(PostHogMaskView)`
  gap: 12px;
`;

const Field = styled.TextInput`
  ${({ theme }) => theme.fonts.medium}
  border: 1px solid ${({ theme }) => theme.colors.line};
  border-radius: 14px;
  padding: 14px 16px;
  font-size: 15px;
  color: ${({ theme }) => theme.colors.ink};
  background-color: ${({ theme }) => theme.colors.bg};
`;

// Wide tracking so the six digits read as a code rather than a number.
const CodeField = styled(Field)`
  ${({ theme }) => theme.fonts.bold}
  font-size: 22px;
  letter-spacing: 8px;
  text-align: center;
  padding: 16px;
`;

const SecureWrap = styled.View`
  position: relative;
`;

// Fills the field and repeats its padding, so the drawn placeholder starts
// exactly where the typed text will.
const PlaceholderLayer = styled.View`
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  padding: 14px 16px;
  justify-content: center;
`;

const PlaceholderText = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  font-size: 15px;
  color: ${({ theme }) => theme.colors.dim2};
`;

const ErrorText = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  font-size: 13px;
  line-height: 18px;
  color: ${({ theme }) => theme.colors.error};
`;

const NoticeText = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  font-size: 13px;
  line-height: 18px;
  color: ${({ theme }) => theme.colors.muted};
`;

const DividerRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  margin: 4px 0;
`;

const DividerLine = styled.View`
  flex: 1;
  height: 1px;
  background-color: ${({ theme }) => theme.colors.line};
`;

const DividerText = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  font-size: 12px;
  color: ${({ theme }) => theme.colors.dim2};
`;

const ProviderButton = styled.Pressable`
  flex-direction: row;
  gap: 10px;
  border: 1px solid ${({ theme }) => theme.colors.line};
  border-radius: 1000px;
  height: 50px;
  align-items: center;
  justify-content: center;
`;

const ProviderLabel = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  font-size: 15px;
  color: ${({ theme }) => theme.colors.ink};
`;

const SwitchRow = styled.View`
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
`;

const SwitchText = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  font-size: 13.5px;
  color: ${({ theme }) => theme.colors.muted};
`;

// $muted is the resend link waiting out its cooldown: still readable, plainly
// not tappable yet.
const SwitchLink = styled.Text<{ $muted?: boolean }>`
  ${({ theme }) => theme.fonts.bold}
  font-size: 13.5px;
  color: ${({ theme, $muted }) =>
    $muted ? theme.colors.dim : theme.colors.accent};
`;

export default AuthScreen;
