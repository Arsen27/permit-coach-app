import React from 'react';
import styled from 'styled-components';

import type { CompetitorLesson } from '@admin/api/types';
import AuthedImage from '@admin/features/shell/AuthedImage';

// Competitor courses drawn the way their own apps draw them, from the captured
// screenshots: Zutobi reads as a scrolling article with a teal quiz, myDMV as
// one slide per section with an indigo practice screen. Rendering them in
// their own idiom is what makes the side-by-side comparison honest.

type Props = {
  lesson: CompetitorLesson;
  style: 'article' | 'slides';
  index: number;
  onAdvance?: () => void;
  scrollEnabled?: boolean;
};

// How many pages the pager should offer. Zutobi's theory is one scrolling
// article — captured that way and confirmed against its screenshots — so only
// its post-lesson test paginates. myDMV really is a slide deck: one section
// per slide, then its practice questions.
export const competitorPageCount = (
  lesson: CompetitorLesson,
  style: 'article' | 'slides',
): number => {
  const questions = lesson.test?.questions.length ?? 0;
  return style === 'article'
    ? 1 + questions
    : Math.max(1, lesson.sections.length + questions);
};

const asset = (src: string) => `/v1/admin/competitors/assets/${src}`;

const CompetitorLessonScreen: React.FC<Props> = ({
  lesson,
  style,
  index,
  onAdvance,
  scrollEnabled = true,
}) => {
  const sections = lesson.sections;
  const questions = lesson.test?.questions ?? [];
  const total = competitorPageCount(lesson, style);
  const position = Math.min(index, Math.max(0, total - 1));

  if (style === 'article') {
    // Page 0 is the whole lesson as one scroll, the way Zutobi reads; the test
    // questions after it page one by one.
    const question = position > 0 ? questions[position - 1] : null;

    return question == null ? (
      <ZutobiScreen>
        <ZutobiTop>
          <ZutobiBack>‹</ZutobiBack>
          <ZutobiFlag />
        </ZutobiTop>
        <ZutobiProgress>
          <ZutobiProgressFill style={{ width: '38%' }} />
        </ZutobiProgress>
        <ZutobiBody $scroll={scrollEnabled}>
          <ZutobiEyebrow>Lesson {lesson.sequence}</ZutobiEyebrow>
          <ZutobiTitle>{lesson.title}</ZutobiTitle>
          {sections.map((section, sectionIndex) => (
            <React.Fragment key={sectionIndex}>
              {section.heading != null && sectionIndex > 0 && (
                <ZutobiHeading>{section.heading}</ZutobiHeading>
              )}
              {section.paragraphs.map((paragraph, i) => (
                <ZutobiText key={i}>{paragraph}</ZutobiText>
              ))}
              {section.bullets.map((bullet, i) => (
                <ZutobiBullet key={i}>• {bullet}</ZutobiBullet>
              ))}
              {section.images.map((image, i) => (
                <ZutobiImage key={i} src={asset(image.src)} alt={image.alt} />
              ))}
            </React.Fragment>
          ))}
        </ZutobiBody>
      </ZutobiScreen>
    ) : (
      <ZutobiScreen>
        <ZutobiQuizTop>
          <ZutobiBack>✕</ZutobiBack>
          <ZutobiQuizBar />
          <ZutobiStar>☆</ZutobiStar>
        </ZutobiQuizTop>
        <ZutobiRemaining>
          {questions.length - (position - 1)} remaining
        </ZutobiRemaining>
        {question.image != null && (
          <ZutobiQuizImage
            src={asset(question.image.src)}
            alt={question.image.alt}
          />
        )}
        <ZutobiQuestion>{question.prompt}</ZutobiQuestion>
        <ZutobiOptions>
          {question.options.map(option => (
            <ZutobiOption key={option.letter} onClick={onAdvance}>
              <ZutobiLetter>{option.letter}</ZutobiLetter>
              <ZutobiOptionText>{option.text}</ZutobiOptionText>
            </ZutobiOption>
          ))}
        </ZutobiOptions>
      </ZutobiScreen>
    );
  }

  const question =
    position >= sections.length ? questions[position - sections.length] : null;
  const section = sections[position];

  return question == null && section != null ? (
    <DmvScreen>
      <DmvTop>
        <DmvClose>✕</DmvClose>
        <DmvBar>
          <DmvBarFill
            style={{ width: `${((position + 1) / Math.max(1, total)) * 100}%` }}
          />
        </DmvBar>
        <DmvCount>
          {position + 1}/{total}
        </DmvCount>
      </DmvTop>
      <DmvBody $scroll={scrollEnabled} onClick={onAdvance}>
        {section.images[0] != null && (
          <DmvImage
            src={asset(section.images[0].src)}
            alt={section.images[0].alt}
          />
        )}
        <DmvTitle>{section.heading ?? lesson.title}</DmvTitle>
        {section.paragraphs.map((paragraph, i) => (
          <DmvText key={i}>{paragraph}</DmvText>
        ))}
        {section.bullets.map((bullet, i) => (
          <DmvText key={`b${i}`}>• {bullet}</DmvText>
        ))}
        {section.takeaways.map((takeaway, i) => (
          <DmvTakeaway key={i}>👍 {takeaway}</DmvTakeaway>
        ))}
        {section.stateNotes.length > 0 && (
          <DmvStateNotes>
            {section.stateNotes.map((note, i) => (
              <DmvText key={i}>{note}</DmvText>
            ))}
          </DmvStateNotes>
        )}
      </DmvBody>
    </DmvScreen>
  ) : question != null ? (
    <DmvScreen>
      <DmvTop>
        <DmvClose>‹</DmvClose>
        <DmvBar>
          <DmvBarFill
            style={{ width: `${((position + 1) / Math.max(1, total)) * 100}%` }}
          />
        </DmvBar>
        <DmvCount>★</DmvCount>
      </DmvTop>
      <DmvBody $scroll={scrollEnabled}>
        {question.image != null && (
          <DmvImage src={asset(question.image.src)} alt={question.image.alt} />
        )}
        <DmvTitle>{question.prompt}</DmvTitle>
        {question.options.map(option => (
          <DmvOption
            key={option.letter}
            $correct={option.letter === question.correctLetter}
            onClick={onAdvance}
          >
            <DmvMark $correct={option.letter === question.correctLetter}>
              {option.letter === question.correctLetter ? '✓' : '✕'}
            </DmvMark>
            {option.text}
          </DmvOption>
        ))}
      </DmvBody>
      <DmvFooter>
        <DmvNext onClick={onAdvance}>Next question</DmvNext>
      </DmvFooter>
    </DmvScreen>
  ) : (
    <DmvScreen>
      <DmvEmpty>This lesson has no captured content</DmvEmpty>
    </DmvScreen>
  );
};

export default CompetitorLessonScreen;

// --- Zutobi -----------------------------------------------------------------

const ZutobiScreen = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  overflow: hidden;
`;

const ZutobiTop = styled.div`
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 62px 24px 10px;
  font-size: 22px;
  color: #6b7280;
`;

const ZutobiBack = styled.span``;
const ZutobiFlag = styled.span`
  width: 14px;
  height: 17px;
  border: 2px solid #9aa2b1;
  border-bottom: none;
  border-radius: 1px;
`;

const ZutobiProgress = styled.div`
  flex: none;
  height: 3px;
  background: #eef0f3;
`;

const ZutobiProgressFill = styled.div`
  height: 100%;
  background: #00b3a4;
`;

const ZutobiBody = styled.div<{ $scroll: boolean }>`
  flex: 1;
  overflow: ${({ $scroll }) => ($scroll ? 'auto' : 'hidden')};
  overscroll-behavior: contain;
  padding: 22px 24px 120px;
`;

const ZutobiEyebrow = styled.div`
  font-size: 15px;
  font-weight: 500;
  color: #7b8494;
  margin-bottom: 6px;
`;

const ZutobiTitle = styled.h1`
  margin: 0 0 22px;
  font-size: 34px;
  line-height: 1.12;
  font-weight: 800;
  letter-spacing: -0.8px;
  color: #16181d;
`;

const ZutobiHeading = styled.h2`
  margin: 26px 0 12px;
  font-size: 22px;
  font-weight: 700;
  color: #16181d;
`;

const ZutobiText = styled.p`
  margin: 0 0 16px;
  font-size: 17px;
  line-height: 1.5;
  color: #2b2f36;
`;

const ZutobiBullet = styled.p`
  margin: 0 0 10px 6px;
  font-size: 17px;
  line-height: 1.45;
  color: #2b2f36;
`;

const ZutobiImage = styled(AuthedImage)`
  width: 100%;
  border-radius: 4px;
  margin: 6px 0 18px;
  display: block;
`;

const ZutobiQuizTop = styled.div`
  flex: none;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 62px 24px 6px;
  font-size: 22px;
  color: #16181d;
`;

const ZutobiQuizBar = styled.div`
  flex: 1;
  height: 6px;
  border-radius: 99px;
  background: #eef0f3;
`;

const ZutobiStar = styled.span`
  color: #16181d;
`;

const ZutobiRemaining = styled.div`
  flex: none;
  text-align: center;
  font-size: 15px;
  color: #7b8494;
  padding-bottom: 12px;
`;

const ZutobiQuizImage = styled(AuthedImage)`
  width: 100%;
  height: 190px;
  object-fit: cover;
  display: block;
`;

const ZutobiQuestion = styled.h2`
  margin: 20px 24px 18px;
  font-size: 19px;
  line-height: 1.3;
  font-weight: 700;
  color: #16181d;
`;

const ZutobiOptions = styled.div`
  padding: 0 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ZutobiOption = styled.button`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border: 1px solid #e6eaee;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
`;

const ZutobiLetter = styled.span`
  font-size: 19px;
  font-weight: 600;
  color: #8fd6d0;
`;

const ZutobiOptionText = styled.span`
  font-size: 16px;
  color: #16181d;
`;

// --- myDMV ------------------------------------------------------------------

const DmvScreen = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: linear-gradient(#f4f5ff, #ffffff 30%);
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  overflow: hidden;
`;

const DmvTop = styled.div`
  flex: none;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 62px 22px 12px;
  font-size: 19px;
  color: #16181d;
`;

const DmvClose = styled.span`
  width: 38px;
  height: 38px;
  border-radius: 99px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
`;

const DmvBar = styled.div`
  flex: 1;
  height: 8px;
  border-radius: 99px;
  background: #edeef4;
  overflow: hidden;
`;

const DmvBarFill = styled.div`
  height: 100%;
  background: #5b5bef;
`;

const DmvCount = styled.span`
  font-size: 15px;
  font-weight: 600;
  color: #4b5060;
`;

const DmvBody = styled.div<{ $scroll: boolean }>`
  flex: 1;
  overflow: ${({ $scroll }) => ($scroll ? 'auto' : 'hidden')};
  overscroll-behavior: contain;
  padding: 10px 22px 130px;
`;

const DmvImage = styled(AuthedImage)`
  width: 100%;
  border-radius: 16px;
  margin-bottom: 18px;
  display: block;
  max-height: 240px;
  object-fit: cover;
`;

const DmvTitle = styled.h1`
  margin: 0 0 16px;
  font-size: 26px;
  line-height: 1.2;
  font-weight: 800;
  letter-spacing: -0.6px;
  color: #16181d;
`;

const DmvText = styled.p`
  margin: 0 0 14px;
  font-size: 16px;
  line-height: 1.5;
  color: #3a3f4b;
`;

const DmvTakeaway = styled.p`
  margin: 14px 0;
  font-size: 16px;
  font-weight: 700;
  color: #16181d;
`;

const DmvStateNotes = styled.div`
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #f1f2fb;
`;

const DmvOption = styled.button<{ $correct: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  margin-bottom: 12px;
  padding: 16px 18px;
  border: none;
  border-radius: 14px;
  font-family: inherit;
  font-size: 16px;
  line-height: 1.35;
  text-align: left;
  cursor: pointer;
  color: #fff;
  background: ${({ $correct }) => ($correct ? '#2FA84F' : '#E2483D')};
`;

const DmvMark = styled.span<{ $correct: boolean }>`
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 99px;
  background: #fff;
  color: ${({ $correct }) => ($correct ? '#2FA84F' : '#E2483D')};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 800;
`;

const DmvFooter = styled.div`
  position: absolute;
  left: 22px;
  right: 22px;
  bottom: 26px;
`;

const DmvNext = styled.button`
  width: 100%;
  height: 52px;
  border: none;
  border-radius: 99px;
  background: #5b5bef;
  color: #fff;
  font-family: inherit;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
`;

const DmvEmpty = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  color: #9aa2b1;
`;
