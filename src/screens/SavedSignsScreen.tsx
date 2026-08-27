import React, { useLayoutEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styled, { useTheme } from 'styled-components/native';

import { NativeStackScreenProps } from '@react-navigation/native-stack';

import GlassCircleButton from '@/components/GlassCircleButton';
import HeaderCount from '@/components/HeaderCount';
import Icon from '@/components/Icon';
import SignGrid from '@/components/SignGrid';
import { Eyebrow } from '@/components/typography';
import { savedSigns } from '@/data/signs';
import { useSignsCatalog } from '@/data/signs/SignsProvider';
import { RootStackParamList } from '@/navigation/types';
import { useAppState } from '@/state/AppState';

type SavedSignsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'SavedSigns'
>;

// Everything the learner bookmarked from a sign detail, grouped under the
// category each sign belongs to so the list still reads like the cheatsheet
// it was picked from.
const SavedSignsScreen: React.FC<SavedSignsScreenProps> = ({ navigation }) => {
  const catalog = useSignsCatalog();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { savedSignIds } = useAppState();

  // Category order comes from the catalogue, so the groups sit in the same
  // order as the cheatsheet; within a group the signs keep the order they
  // were saved in.
  const groups = useMemo(() => {
    const saved = savedSigns(savedSignIds);
    return catalog.categories
      .map(category => ({
        category,
        signs: saved.filter(sign => sign.categoryId === category.id),
      }))
      .filter(group => group.signs.length > 0);
  }, [catalog, savedSignIds]);

  // Counts what is actually on screen, not raw bookmark ids: a sign a
  // catalogue update removed is neither listed nor counted.
  const count = groups.reduce((total, group) => total + group.signs.length, 0);

  // iOS: the count is a native bar item, installed from here rather than in
  // the navigator so unsaving a sign and coming back updates it.
  useLayoutEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }
    navigation.setOptions({
      unstable_headerRightItems: () =>
        count === 0
          ? []
          : [
              {
                type: 'custom',
                element: <HeaderCount>{countLabel(count)}</HeaderCount>,
                hidesSharedBackground: true,
              },
            ],
    });
  }, [navigation, count]);

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
          <HeaderTitle>Saved signs</HeaderTitle>
          {count > 0 && <HeaderCount>{countLabel(count)}</HeaderCount>}
        </Header>
      )}

      {count === 0 ? (
        <Empty>
          <EmptyTile>
            <Icon name="bookmark" size={20} color={theme.colors.muted} />
          </EmptyTile>
          <EmptyTitle>Nothing saved yet</EmptyTitle>
          <EmptyText>
            Open any sign and tap the bookmark to keep it here for a last look
            before the test.
          </EmptyText>
        </Empty>
      ) : (
        groups.map(group => (
          <GroupBlock key={group.category.id}>
            <GroupHead>
              <Eyebrow style={{ color: group.category.color }}>
                {group.category.name}
              </Eyebrow>
              <GroupCount>{group.signs.length}</GroupCount>
            </GroupHead>
            <SignGrid
              signs={group.signs}
              onPressSign={signId =>
                navigation.navigate('SignDetail', { signId })
              }
            />
          </GroupBlock>
        ))
      )}
    </Screen>
  );
};

const countLabel = (count: number): string =>
  `${count} sign${count === 1 ? '' : 's'}`;

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

const GroupBlock = styled.View`
  margin-bottom: 24px;
`;

const GroupHead = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 0 22px 12px;
`;

const GroupCount = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.muted};
  font-variant: tabular-nums;
`;

const Empty = styled.View`
  align-items: center;
  padding: 48px 40px 0;
  gap: 12px;
`;

const EmptyTile = styled.View`
  width: 52px;
  height: 52px;
  border-radius: 9999px;
  background-color: ${({ theme }) => theme.colors.faint};
  align-items: center;
  justify-content: center;
`;

const EmptyTitle = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 17px;
  letter-spacing: -0.4px;
  color: ${({ theme }) => theme.colors.ink};
`;

const EmptyText = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  font-size: 13.5px;
  line-height: 21px;
  text-align: center;
  color: ${({ theme }) => theme.colors.muted};
`;

export default SavedSignsScreen;
