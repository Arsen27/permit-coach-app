import React from 'react';
import { Platform, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styled, { useTheme } from 'styled-components/native';

import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { track } from '@/analytics';
import GlassCircleButton from '@/components/GlassCircleButton';
import Icon from '@/components/Icon';
import { Group } from '@/components/rows';
import { RootStackParamList } from '@/navigation/types';
import { useAppState } from '@/state/AppState';
import { FONT_OPTIONS } from '@/theme';

type FontPickerScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'FontPicker'
>;

const FontPickerScreen: React.FC<FontPickerScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { fontId, setFont } = useAppState();

  return (
    <Screen
      contentContainerStyle={{
        paddingTop: Platform.OS === 'ios' ? 10 : insets.top + 10,
        paddingBottom: 40 + insets.bottom,
      }}
      showsVerticalScrollIndicator={false}
    >
      {Platform.OS !== 'ios' && (
        <Header>
          <GlassCircleButton
            icon="chevron-left"
            iconColor={theme.colors.body}
            onPress={() => navigation.goBack()}
          />
          <HeaderTitle>App font</HeaderTitle>
        </Header>
      )}
      <Body>
        <Group>
          {FONT_OPTIONS.map((option, index) => {
            const selected = option.id === fontId;
            // Each row previews its own family, independent of the app font.
            const previewStyle =
              option.files != null
                ? { fontFamily: option.files.semiBold }
                : {
                    fontWeight: '600' as const,
                    fontFamily: Platform.select({ android: 'sans-serif' }),
                  };
            return (
              <FontRow
                key={option.id}
                $divider={index < FONT_OPTIONS.length - 1}
                $selected={selected}
                onPress={() => {
                  track('font_changed', { font_id: option.id });
                  setFont(option.id);
                }}
              >
                <FontInfo>
                  <Text
                    style={[
                      previewStyle,
                      { fontSize: 15, color: theme.colors.ink },
                    ]}
                  >
                    {option.label}
                  </Text>
                  <PreviewText style={previewStyle}>
                    Yield to traffic on the right
                  </PreviewText>
                </FontInfo>
                {selected && (
                  <Icon name="check" size={14} color={theme.colors.accent} />
                )}
              </FontRow>
            );
          })}
        </Group>
      </Body>
    </Screen>
  );
};

const Screen = styled.ScrollView`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.bg};
`;

const Header = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 10px 20px 16px;
`;

const HeaderTitle = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  flex: 1;
  font-size: 19px;
  letter-spacing: -0.5px;
  color: ${({ theme }) => theme.colors.ink};
`;

const Body = styled.View`
  padding: 0 22px;
`;

const FontRow = styled.Pressable<{ $divider: boolean; $selected: boolean }>`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 16px;
  border-bottom-width: ${({ $divider }) => ($divider ? 1 : 0)}px;
  border-bottom-color: ${({ theme }) => theme.colors.faint};
  background-color: ${({ theme, $selected }) =>
    $selected ? theme.colors.accentSoft : 'transparent'};
`;

const FontInfo = styled.View`
  flex: 1;
  gap: 3px;
`;

const PreviewText = styled.Text`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted};
`;

export default FontPickerScreen;
