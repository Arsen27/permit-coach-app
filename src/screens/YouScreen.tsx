import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Switch,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styled, { useTheme } from 'styled-components/native';

import { useNavigation } from '@react-navigation/native';

import { track } from '@/analytics';
import { useAuth } from '@/auth/AuthProvider';
import Icon from '@/components/Icon';
import PrimaryButton from '@/components/PrimaryButton';
import ScreenHeader from '@/components/ScreenHeader';
import {
  Group,
  Row,
  RowBody,
  RowSub,
  RowTile,
  RowTitle,
  RowValue,
} from '@/components/rows';
import { Eyebrow } from '@/components/typography';
import CourseInstallSheet from '@/components/CourseInstallSheet';
import { courseIdForState } from '@/data/course';
import { courseStore } from '@/data/course/store';
import { useCourseInstall } from '@/data/course/useCourseInstall';
import { findState } from '@/data/states';
import {
  getStagingKey,
  setContentChannel,
  setStagingKey,
  useContentChannel,
} from '@/lib/contentChannel';
import { setDevUnlockAll, useDevUnlockAll } from '@/lib/devUnlock';
import {
  PRIVACY_POLICY_URL,
  SUPPORT_EMAIL,
  TERMS_OF_USE_URL,
} from '@/lib/legalLinks';
import { RootNavigation } from '@/navigation/types';
import { openManageSubscriptions } from '@/purchases/manageSubscriptions';
import { usePurchases } from '@/purchases/PurchasesProvider';
import { useAppState } from '@/state/AppState';
import { FONT_OPTIONS } from '@/theme';

// The long-form unofficial notice for About. The short version lives in
// UnofficialDisclaimer (onboarding + paywall); this one spells the whole
// relationship out.
const ABOUT_DISCLAIMER =
  'PermitCoach is an independent educational study aid. It is not affiliated with, endorsed by, approved by, sponsored by, authorized by, or operated by any DMV or other government agency. PermitCoach content is not official and does not guarantee that you will pass an exam or receive a permit or driver’s license. Always verify current requirements with the official agency for your state.';

// `target` is the label the event carries — the URL itself would make every
// state's handbook its own value.
const openUrl = (url: string, target: string) => {
  track('external_link_opened', { target });
  Linking.openURL(url).catch(() => undefined);
};

const YouScreen: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<RootNavigation>();
  const { user, points, lessonsDone, bestExam, fontId } = useAppState();
  const { signedIn, hasAccount, email, logOut, deleteAccount } = useAuth();
  // Plus status still gates content and shows on the profile; buying and
  // restoring moved out of Settings for this release.
  const { plusActive } = usePurchases();
  const devUnlockAll = useDevUnlockAll();
  const contentChannel = useContentChannel();
  const install = useCourseInstall();
  const [stagingKeyDraft, setStagingKeyDraft] = useState(getStagingKey);
  // Switching channels throws away what the other one put on this device and
  // downloads the course again, so it goes through the same sheet the state
  // switch and onboarding use.
  const switchChannel = useCallback(
    async (toStaging: boolean) => {
      const next = toStaging ? 'staging' : 'production';
      await setContentChannel(next, courseStore.wipeDownloadedContent);
      await install.start(courseIdForState(user.stateCode));
    },
    [install, user.stateCode],
  );
  // Deletion in flight: the ref guards against a second tap racing the state
  // update, the state drives the disabled/spinner treatment.
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);

  const usState = findState(user.stateCode);
  const fontLabel =
    FONT_OPTIONS.find(option => option.id === fontId)?.label ?? '';
  // Profile name (adopted from the identity provider or set later) → email
  // local part for email-only accounts → Guest for anonymous ones.
  const displayName =
    user.name || (email != null ? email.split('@')[0] : 'Guest');
  const initial = displayName.slice(0, 1).toUpperCase();
  // RevenueCat entitlement is the live source of truth; profiles.plan (synced
  // into user.plan) is the webhook-written mirror we fall back to.
  const isPlus = plusActive ?? user.plan === 'plus';

  const runDeleteAccount = async () => {
    if (deletingRef.current) {
      return;
    }
    deletingRef.current = true;
    setDeleting(true);
    try {
      const result = await deleteAccount();
      if (!result.ok) {
        Alert.alert('Unable to delete account', result.message);
      }
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  };

  const confirmDeleteAccount = () => {
    if (deletingRef.current) {
      return;
    }
    // Only a definite "no active entitlement" from RevenueCat gets the plain
    // confirmation. Active — or still unknown — gets the store-subscription
    // warning: deleting the account never cancels an App Store / Google Play
    // subscription, and the learner must hear that before, not after.
    if (plusActive === false) {
      Alert.alert(
        'Delete account?',
        'This permanently deletes your PermitCoach account and synced study progress. This action cannot be undone.',
        [
          {
            text: 'Delete Account',
            style: 'destructive',
            onPress: () => runDeleteAccount(),
          },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return;
    }
    const storeName = Platform.OS === 'ios' ? 'App Store' : 'Google Play';
    Alert.alert(
      'Delete account?',
      `Deleting your PermitCoach account will permanently erase your synced progress and account data. It will not cancel your ${storeName} subscription, and you may continue to be charged unless you cancel it separately.`,
      [
        {
          text: 'Manage Subscription',
          onPress: () => openManageSubscriptions(),
        },
        {
          text: 'Delete Anyway',
          style: 'destructive',
          onPress: () => runDeleteAccount(),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  return (
    <Screen
      contentContainerStyle={
        Platform.OS === 'ios'
          ? { paddingTop: 10, paddingBottom: 24 }
          : { paddingTop: insets.top + 10, paddingBottom: 110 + insets.bottom }
      }
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader title="You" />

      {signedIn ? (
        <AccountRow>
          <Avatar $size={60}>
            <AvatarLetter $size={22}>{initial}</AvatarLetter>
          </Avatar>
          <View style={{ flex: 1 }}>
            <AccountName $large>{displayName}</AccountName>
            <AccountEmail>{email ?? ''}</AccountEmail>
          </View>
          {isPlus && (
            <PlusBadge>
              <PlusBadgeText>PLUS</PlusBadgeText>
            </PlusBadge>
          )}
        </AccountRow>
      ) : (
        <SignUpCard>
          <SignUpTop>
            <Avatar $size={52}>
              <AvatarLetter $size={20}>{initial}</AvatarLetter>
            </Avatar>
            <View style={{ flex: 1 }}>
              <AccountName>{displayName}</AccountName>
              <AccountEmail>Learning on this device</AccountEmail>
            </View>
          </SignUpTop>
          <PrimaryButton
            label="Sign up"
            height={50}
            onPress={() => navigation.navigate('Auth', { mode: 'signUp' })}
          />
          <SignUpNote>
            Create an account to keep progress across devices
          </SignUpNote>
          {/* Returning learners land here too — opening the form straight on
              its sign-in side saves hunting for the switch link inside. */}
          <SignInLink
            onPress={() => navigation.navigate('Auth', { mode: 'signIn' })}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <SignInText>I already have an account</SignInText>
          </SignInLink>
        </SignUpCard>
      )}

      {signedIn && (
        <StatsRow>
          <StatCard>
            <StatValue>{points}</StatValue>
            <StatLabel>Points</StatLabel>
          </StatCard>
          <StatCard>
            <StatValue>{lessonsDone}</StatValue>
            <StatLabel>Lessons</StatLabel>
          </StatCard>
          <StatCard>
            <StatValue>{bestExam != null ? `${bestExam}%` : '—'}</StatValue>
            <StatLabel>Best exam</StatLabel>
          </StatCard>
        </StatsRow>
      )}

      <Section>
        <Eyebrow style={{ marginBottom: 10 }}>Exam</Eyebrow>
        <Group>
          <Row $divider onPress={() => navigation.navigate('StatePicker')}>
            <RowTile $bg={theme.colors.accentSoft}>
              <Icon name="list-check" size={15} color={theme.colors.accent} />
            </RowTile>
            <RowTitle style={{ flex: 1 }}>State</RowTitle>
            <RowValue>{usState.name}</RowValue>
            <Icon name="chevron-right" size={12} color={theme.colors.dim2} />
          </Row>
          <Row
            onPress={() => openUrl(`https://www.${usState.domain}`, 'handbook')}
          >
            <RowTile $bg={theme.colors.faint}>
              <Icon name="file-text" size={15} color={theme.colors.muted} />
            </RowTile>
            <RowBody>
              <RowTitle>Official {usState.code} Driver's Handbook</RowTitle>
              <RowSub>{usState.domain} — opens in browser</RowSub>
            </RowBody>
            <Icon name="arrow-up-right" size={13} color={theme.colors.dim2} />
          </Row>
        </Group>
      </Section>

      <Section>
        <Eyebrow style={{ marginBottom: 10 }}>Appearance</Eyebrow>
        <Group>
          <Row onPress={() => navigation.navigate('FontPicker')}>
            <RowTitle style={{ flex: 1 }}>App font</RowTitle>
            <RowValue>{fontLabel}</RowValue>
            <Icon name="chevron-right" size={12} color={theme.colors.dim2} />
          </Row>
        </Group>
      </Section>

      <Section>
        <Eyebrow style={{ marginBottom: 10 }}>Subscription</Eyebrow>
        <Group>
          <Row
            accessibilityRole="button"
            accessibilityLabel="Manage Subscription"
            onPress={() => {
              track('external_link_opened', { target: 'manage_subscription' });
              openManageSubscriptions();
            }}
          >
            <RowTile $bg={theme.colors.accentSoft}>
              <Icon name="circle-check" size={15} color={theme.colors.accent} />
            </RowTile>
            <RowBody>
              <RowTitle>Manage Subscription</RowTitle>
              <RowSub>
                {Platform.OS === 'ios'
                  ? 'Opens your App Store subscriptions'
                  : 'Opens your Google Play subscriptions'}
              </RowSub>
            </RowBody>
            <Icon name="arrow-up-right" size={13} color={theme.colors.dim2} />
          </Row>
        </Group>
      </Section>

      <Section>
        <Eyebrow style={{ marginBottom: 10 }}>About</Eyebrow>
        <Group>
          <Row
            $divider
            onPress={() =>
              openUrl(
                'https://apps.apple.com/app/id0000000000?action=write-review',
                'app_store_review',
              )
            }
          >
            <AboutTitle>Rate us</AboutTitle>
            <Icon name="chevron-right" size={12} color={theme.colors.dim2} />
          </Row>
          <Row
            $divider
            accessibilityRole="link"
            accessibilityLabel="Privacy Policy"
            onPress={() => openUrl(PRIVACY_POLICY_URL, 'privacy_policy')}
          >
            <AboutTitle>Privacy Policy</AboutTitle>
            <Icon name="arrow-up-right" size={13} color={theme.colors.dim2} />
          </Row>
          <Row
            $divider
            accessibilityRole="link"
            accessibilityLabel="Terms of Use"
            onPress={() => openUrl(TERMS_OF_USE_URL, 'terms')}
          >
            <AboutTitle>Terms of Use</AboutTitle>
            <Icon name="arrow-up-right" size={13} color={theme.colors.dim2} />
          </Row>
          <Row
            accessibilityRole="link"
            accessibilityLabel="Support"
            onPress={() => openUrl(`mailto:${SUPPORT_EMAIL}`, 'support_email')}
          >
            <RowBody>
              <RowTitle>Support</RowTitle>
              <RowSub>{SUPPORT_EMAIL}</RowSub>
            </RowBody>
            <Icon name="arrow-up-right" size={13} color={theme.colors.dim2} />
          </Row>
        </Group>
        <AboutDisclaimer accessibilityRole="text">
          {ABOUT_DISCLAIMER}
        </AboutDisclaimer>
      </Section>

      {__DEV__ && (
        <Section>
          <Eyebrow style={{ marginBottom: 10 }}>Developer</Eyebrow>
          <Group>
            <Row $divider onPress={() => navigation.navigate('Onboarding')}>
              <RowTile $bg={theme.colors.faint}>
                <Icon name="book-open" size={15} color={theme.colors.muted} />
              </RowTile>
              <RowBody>
                <RowTitle>Run onboarding</RowTitle>
                <RowSub>Replays the first-launch flow</RowSub>
              </RowBody>
              <Icon name="chevron-right" size={12} color={theme.colors.dim2} />
            </Row>
            <Row $divider>
              <RowTile $bg={theme.colors.faint}>
                <Icon name="lock" size={15} color={theme.colors.muted} />
              </RowTile>
              <RowBody>
                <RowTitle>Unlock all lessons</RowTitle>
                <RowSub>Open any lesson or module test out of order</RowSub>
              </RowBody>
              <Switch
                value={devUnlockAll}
                onValueChange={setDevUnlockAll}
                trackColor={{ true: theme.colors.accent }}
              />
            </Row>
            <Row $divider>
              <RowTile $bg={theme.colors.faint}>
                <Icon name="file-text" size={15} color={theme.colors.muted} />
              </RowTile>
              <RowBody>
                <RowTitle>Content channel · {contentChannel}</RowTitle>
                <RowSub>
                  {stagingKeyDraft.trim().length === 0
                    ? 'Enter the staging key below first'
                    : 'Erases the downloaded course and re-downloads from the channel'}
                </RowSub>
              </RowBody>
              <Switch
                value={contentChannel === 'staging'}
                disabled={stagingKeyDraft.trim().length === 0}
                onValueChange={value => void switchChannel(value)}
                trackColor={{ true: theme.colors.accent }}
              />
            </Row>
            <Row>
              <RowTile $bg={theme.colors.faint}>
                <Icon name="lock" size={15} color={theme.colors.muted} />
              </RowTile>
              <RowBody>
                <RowTitle>Staging key</RowTitle>
                <KeyInput
                  value={stagingKeyDraft}
                  onChangeText={next => {
                    setStagingKeyDraft(next);
                    setStagingKey(next.trim());
                  }}
                  placeholder="STAGING_KEY"
                  placeholderTextColor={theme.colors.dim2}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
              </RowBody>
            </Row>
          </Group>
        </Section>
      )}

      {__DEV__ && (
        <CourseInstallSheet
          phase={install.phase}
          progress={install.progress}
          stateName={findState(user.stateCode)?.name ?? 'your state'}
          onRetry={() => void switchChannel(contentChannel === 'staging')}
          onCancel={install.reset}
        />
      )}

      {/* Delete Account is offered to every real Supabase account — the
          anonymous one every online install gets included (guideline
          5.1.1(v)). Before any session exists there is nothing to delete,
          so nothing is shown. Log out stays a signed-in affair. */}
      {hasAccount && (
        <Section>
          {signedIn && (
            <LogOutCard
              accessibilityRole="button"
              accessibilityLabel="Log out"
              onPress={() => logOut()}
            >
              <LogOutText>Log out</LogOutText>
            </LogOutCard>
          )}
          <DeleteAccountLink
            accessibilityRole="button"
            accessibilityLabel="Delete account"
            accessibilityState={{ disabled: deleting, busy: deleting }}
            disabled={deleting}
            onPress={confirmDeleteAccount}
            hitSlop={8}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={theme.colors.dim} />
            ) : (
              <DeleteAccountText>Delete account</DeleteAccountText>
            )}
          </DeleteAccountLink>
        </Section>
      )}

      {/* The state follows the learner's choice rather than naming one, since
          the course already switches with it. The version is a hand-kept
          string: keep it in step with MARKETING_VERSION in the Xcode project
          and versionName in android/app/build.gradle. */}
      <Version>{`Version 1.1 · Made for the ${usState.name} permit test 2026`}</Version>
    </Screen>
  );
};

const Screen = styled.ScrollView`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.bg};
`;

const AccountRow = styled.View`
  margin: 0 22px 24px;
  flex-direction: row;
  align-items: center;
  gap: 15px;
`;

const Avatar = styled.View<{ $size: number }>`
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: 9999px;
  background-color: ${({ theme }) => theme.colors.accentSoft};
  align-items: center;
  justify-content: center;
`;

const AvatarLetter = styled.Text<{ $size: number }>`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: ${({ $size }) => $size}px;
  color: ${({ theme }) => theme.colors.accent};
`;

const AccountName = styled.Text<{ $large?: boolean }>`
  ${({ theme }) => theme.fonts.extraBold}
  margin-bottom: 2px;
  font-size: ${({ $large }) => ($large ? 18 : 16)}px;
  letter-spacing: -0.35px;
  color: ${({ theme }) => theme.colors.ink};
`;

const AccountEmail = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.muted};
`;

const PlusBadge = styled.View`
  padding: 5px 12px;
  border-radius: 9999px;
  background-color: ${({ theme }) => theme.colors.doneSoft};
`;

const PlusBadgeText = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 11px;
  letter-spacing: 0.3px;
  color: ${({ theme }) => theme.colors.doneText};
`;

const SignUpCard = styled.View`
  margin: 0 22px 24px;
  border: 1px solid ${({ theme }) => theme.colors.line};
  border-radius: 16px;
  padding: 18px;
  gap: 14px;
`;

const SignUpTop = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 14px;
`;

const SignUpNote = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  font-size: 12px;
  line-height: 17px;
  text-align: center;
  color: ${({ theme }) => theme.colors.muted};
`;

const SignInLink = styled.Pressable`
  align-self: center;
  margin-top: 4px;
  padding: 6px 4px;
`;

const SignInText = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  font-size: 13px;
  color: ${({ theme }) => theme.colors.accent};
`;

const StatsRow = styled.View`
  margin: 0 22px 24px;
  flex-direction: row;
  gap: 12px;
`;

const StatCard = styled.View`
  flex: 1;
  border: 1px solid ${({ theme }) => theme.colors.line};
  border-radius: 14px;
  padding: 12px 14px;
`;

const StatValue = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 19px;
  letter-spacing: -0.5px;
  color: ${({ theme }) => theme.colors.ink};
  font-variant: tabular-nums;
`;

const StatLabel = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  font-size: 11.5px;
  color: ${({ theme }) => theme.colors.muted};
`;

const Section = styled.View`
  padding: 0 22px 24px;
`;

const AboutTitle = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  flex: 1;
  font-size: 14.5px;
  letter-spacing: -0.2px;
  color: ${({ theme }) => theme.colors.ink};
`;

const AboutDisclaimer = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  margin-top: 12px;
  padding: 0 4px;
  font-size: 12px;
  line-height: 17px;
  color: ${({ theme }) => theme.colors.muted};
`;

const LogOutCard = styled.Pressable`
  border: 1px solid ${({ theme }) => theme.colors.line};
  border-radius: 16px;
  padding: 14px 16px;
  align-items: center;
`;

const LogOutText = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  font-size: 14.5px;
  color: ${({ theme }) => theme.colors.error};
`;

const DeleteAccountLink = styled.Pressable`
  align-items: center;
  padding-top: 14px;
`;

const DeleteAccountText = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.dim};
`;

const Version = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  padding: 0 22px;
  text-align: center;
  font-size: 11.5px;
  color: ${({ theme }) => theme.colors.dim};
`;

const KeyInput = styled.TextInput`
  margin-top: 2px;
  padding: 0;
  ${({ theme }) => theme.fonts.medium}
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted};
`;

export default YouScreen;
