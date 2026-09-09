import React from 'react';
import { ScrollView, View } from 'react-native';
import { ThemeProvider } from 'styled-components/native';

import LessonCardBody from '@/components/lesson/LessonCardBody';
import { buildCards, cardAssetId } from '@/components/lesson/cards';
import type { ModuleDocV2 } from '@/data/course/v2/wire';
import { defaultTheme } from '@/theme';

// The first module of the California course, straight from the server
// content tree — the app bundles no course, so the served documents are the
// only real content there is. Version trees are immutable and retained, so a
// literal version keeps working; bump it when a newer release is worth
// smoking against.
import firstModuleDoc from '../../server/content/ca-class-c/3.2.11/modules/ca-your-first-drive.json';

// Phase-2 gate: proves the app's own card renderer runs under react-native-web
// with real course content before any admin UI is built on top of it.

const moduleDoc = firstModuleDoc as unknown as ModuleDocV2;

const questionById = new Map(moduleDoc.questions.map(q => [q.questionId, q]));
const assetById = new Map(moduleDoc.assets.map(a => [a.assetId, a]));

const RendererSmoke: React.FC = () => {
  const lesson = moduleDoc.module.lessons[0];
  const cards = buildCards(lesson);

  return (
    <ThemeProvider theme={defaultTheme}>
      <View
        style={{
          maxWidth: 420,
          alignSelf: 'center',
          backgroundColor: '#fff',
        }}
      >
        <ScrollView>
          {cards.map((card, index) => {
            const question =
              card.questionId != null
                ? questionById.get(card.questionId)
                : undefined;
            const assetId = cardAssetId(card, question?.assetId);

            return (
              <View
                key={card.key}
                style={{ borderBottomWidth: 1, borderBottomColor: '#eee' }}
              >
                <LessonCardBody
                  card={card}
                  question={question}
                  asset={assetId != null ? assetById.get(assetId) : undefined}
                  onSelect={() => {}}
                  stateLabel="California"
                  checkpointOrdinal={index}
                  checkpointTotal={lesson.questionIds.length}
                />
              </View>
            );
          })}
        </ScrollView>
      </View>
    </ThemeProvider>
  );
};

export default RendererSmoke;
