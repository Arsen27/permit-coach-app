import React, { useState } from 'react';
import styled from 'styled-components';

import type {
  CardStyleV2,
  KnownBlockType,
  LessonDocV2,
} from '@/data/course/v2/wire';
import {
  blockElements,
  blockStyleId,
  isCheckYourselfBlock,
  isImageBlock,
  isQuickChallengeBlock,
  recallGapErrors,
} from '@/data/course/v2/wire';
import { kickerColor } from '@admin/features/viewer/CardView';
import { assetSrc, uploadArtwork } from '@admin/model/svg';
import {
  TEACHING_TYPES,
  customSlideTypes,
  lessonSlides,
  slideTypesOf,
  type SlideKind,
} from '@admin/model/slides';
import { cardMetaFor } from '@/components/lesson/cards';
import { useEdit } from '@admin/store/editStore';
import { useUi } from '@admin/store/uiStore';
import { admin } from '@admin/styles/theme';

import QuestionEditor from './QuestionEditor';
import LessonScreenEditor from './LessonScreenEditor';
import QuestionPicker from './QuestionPicker';
import SlideBodyEditor, { type ImagePick } from './SlideBodyEditor';
import {
  BodyArea,
  DashedButton,
  FieldLabel,
  Select,
  SmallButton,
  SmallInput,
  TitleInput,
  Warning,
} from './fields';

// Editing works on the same slide sequence the learner swipes through, so the
// editor is laid out slide by slide rather than as a document form. Each slide
// owns its type, its kind, its body and its order — everything a card is.

type Props = {
  doc: LessonDocV2;
  stateLabel: string;
  cardStyles: CardStyleV2[];
  onManageTypes: () => void;
};

const KIND_LABEL: Record<Exclude<SlideKind, 'image' | 'unknown'>, string> = {
  text: 'Text',
  quiz: 'Quiz',
  recall: 'Check yourself',
};

const KINDS = Object.keys(KIND_LABEL) as Exclude<
  SlideKind,
  'image' | 'unknown'
>[];

const EditCardList: React.FC<Props> = ({
  doc,
  stateLabel,
  cardStyles,
  onManageTypes,
}) => {
  const editBlock = useEdit(state => state.editBlock);
  const setAssetAlt = useEdit(state => state.setAssetAlt);
  const editQuestion = useEdit(state => state.editQuestion);
  const setSlideQuestion = useEdit(state => state.setSlideQuestion);
  const setQuestionPicture = useEdit(state => state.setQuestionPicture);
  const setHeroAsset = useEdit(state => state.setHeroAsset);
  const clearQuestionPicture = useEdit(state => state.clearQuestionPicture);
  const courseId = useEdit(state => state.courseId);
  const draftId = useEdit(state => state.draftId);
  // Which slot is being re-pointed at the pool, if any.
  const [picking, setPicking] = useState<{
    blockId: string;
    slot: 'main' | 'checkpoint';
    current: string;
  } | null>(null);
  const replaceAsset = useEdit(state => state.replaceAsset);
  const addRowImage = useEdit(state => state.addRowImage);
  const removeImageByAsset = useEdit(state => state.removeImageByAsset);
  const moveSlide = useEdit(state => state.moveSlide);
  const removeSlide = useEdit(state => state.removeSlide);
  const addSlide = useEdit(state => state.addSlide);
  const setSlideStyle = useEdit(state => state.setSlideStyle);
  const setSlideKind = useEdit(state => state.setSlideKind);
  const setBlockType = useEdit(state => state.setBlockType);
  const setCheckpoint = useEdit(state => state.setCheckpoint);
  const showToast = useUi(state => state.showToast);

  // One hidden file input serves every image action; the pending pick says
  // what the chosen file is for.
  const filePick = React.useRef<HTMLInputElement>(null);
  const pending = React.useRef<ImagePick | null>(null);

  const chooseFile = (pick: ImagePick) => {
    pending.current = pick;
    filePick.current?.click();
  };

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const pick = pending.current;
    event.target.value = '';
    pending.current = null;
    if (file == null || pick == null) {
      return;
    }
    try {
      // Uploaded first: a lesson points at a picture, so the picture has to
      // exist before it can be named.
      const svg = await uploadArtwork(file);
      if (pick.kind === 'hero') {
        setHeroAsset(
          svg,
          file.name.replace(/\.(svg|png|jpe?g)$/i, '').replace(/[-_]+/g, ' '),
        );
        showToast('Lesson hero pinned');
      } else if (pick.kind === 'question') {
        setQuestionPicture(
          pick.questionId,
          svg,
          file.name.replace(/\.(svg|png|jpe?g)$/i, '').replace(/[-_]+/g, ' '),
        );
        showToast('Question picture set');
      } else if (pick.kind === 'replace') {
        replaceAsset(pick.assetId, svg);
        showToast('Illustration replaced');
      } else {
        addRowImage(
          pick.blockId,
          pick.index,
          svg,
          file.name.replace(/\.(svg|png|jpe?g)$/i, '').replace(/[-_]+/g, ' '),
        );
        showToast('Illustration added');
      }
    } catch (error) {
      showToast((error as Error).message);
    }
  };

  const slides = lessonSlides(doc.lesson.blocks);
  const assets = new Map(doc.assets.map(asset => [asset.assetId, asset]));
  const questions = new Map(
    doc.questions.map(question => [question.questionId, question]),
  );
  const types = slideTypesOf(cardStyles);
  const custom = customSlideTypes(cardStyles);

  return (
    <Column>
      <HiddenFile
        ref={filePick}
        type="file"
        accept=".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg"
        onChange={event => void onFile(event)}
      />
      <Head>
        <Title>{doc.lesson.title}</Title>
        <Editing>editing draft</Editing>
        <Spacer />
        <SmallButton
          title="Add, edit and recolour the slide types this course uses"
          onClick={onManageTypes}
        >
          Slide types…
        </SmallButton>
      </Head>

      <LessonScreenEditor
        doc={doc}
        assets={assets}
        onPickHero={() => chooseFile({ kind: 'hero' })}
      />

      <Slides>
        {slides.map((slide, index) => {
          const { block } = slide;
          const meta = cardMetaFor(block, stateLabel, cardStyles);
          const styleId = blockStyleId(block);
          const question =
            slide.questionId == null
              ? undefined
              : questions.get(slide.questionId);
          const checkpoint =
            slide.checkpointQuestionId == null
              ? undefined
              : questions.get(slide.checkpointQuestionId);
          const leadingAsset =
            slide.leadingAssetId == null
              ? undefined
              : assets.get(slide.leadingAssetId);
          const isText = slide.kind === 'text';
          // A block family a built-in style no longer covers still needs its
          // own row in the picker so selecting it is possible.
          const familyOptions = isText
            ? TEACHING_TYPES
            : ([block.type] as KnownBlockType[]);

          return (
            <React.Fragment key={slide.blockId}>
              <Slide>
                <SlideHead>
                  <Index>{String(index + 1).padStart(2, '0')}</Index>
                  <Kicker $color={kickerColor(meta)}>{meta.label}</Kicker>
                  <Spacer />

                  {slide.kind !== 'image' && slide.kind !== 'unknown' && (
                    <Select
                      value={slide.kind}
                      title="What this slide is: teaching copy, a quiz, or a check-yourself card"
                      onChange={event =>
                        setSlideKind(
                          slide.blockId,
                          event.target.value as SlideKind,
                        )
                      }
                    >
                      {KINDS.map(kind => (
                        <option key={kind} value={kind}>
                          {KIND_LABEL[kind]}
                        </option>
                      ))}
                    </Select>
                  )}

                  {slide.kind !== 'image' && (
                    <Select
                      value={styleId}
                      title="The slide type — the kicker, icon and colours above the title"
                      onChange={event => {
                        const chosen = event.target.value;
                        if (familyOptions.includes(chosen as KnownBlockType)) {
                          setBlockType(slide.blockId, chosen as KnownBlockType);
                          // Asking for a built-in family also drops whatever
                          // custom type was overriding it.
                          setSlideStyle(slide.blockId, chosen);
                          return;
                        }
                        setSlideStyle(slide.blockId, chosen);
                      }}
                    >
                      {familyOptions.map(type => (
                        <option key={type} value={type}>
                          {types.find(item => item.styleId === type)?.label ??
                            type}
                        </option>
                      ))}
                      {custom.map(type => (
                        <option key={type.styleId} value={type.styleId}>
                          {type.label}
                        </option>
                      ))}
                      {!familyOptions.includes(styleId as KnownBlockType) &&
                        !custom.some(type => type.styleId === styleId) && (
                          <option value={styleId}>{styleId} (missing)</option>
                        )}
                    </Select>
                  )}

                  <SmallButton
                    title="Move this slide up"
                    disabled={index === 0}
                    onClick={() => moveSlide(slide.blockId, -1)}
                  >
                    ↑
                  </SmallButton>
                  <SmallButton
                    title="Move this slide down"
                    disabled={index === slides.length - 1}
                    onClick={() => moveSlide(slide.blockId, 1)}
                  >
                    ↓
                  </SmallButton>
                  <SmallButton
                    title="Delete this slide"
                    disabled={slides.length <= 1}
                    onClick={() => removeSlide(slide.blockId)}
                  >
                    ✕
                  </SmallButton>
                </SlideHead>

                {'title' in block && (
                  <TitleInput
                    value={block.title}
                    placeholder="Slide title"
                    onChange={event =>
                      editBlock(slide.blockId, {
                        title: event.target.value,
                      } as never)
                    }
                  />
                )}

                {/* Artwork authored before bodies became element lists sits
                    ahead of the card rather than inside it. It keeps working,
                    and can be replaced or removed in place. */}
                {leadingAsset != null && (
                  <ImageBox>
                    <ImagePreview>
                      <PreviewImage
                        src={assetSrc(leadingAsset)}
                        alt={leadingAsset.alt}
                      />
                    </ImagePreview>
                    <ImageBar>
                      <FieldLabel>COVER IMAGE</FieldLabel>
                      <SmallInput
                        value={leadingAsset.alt}
                        placeholder="Describe the illustration"
                        onChange={event =>
                          setAssetAlt(leadingAsset.assetId, event.target.value)
                        }
                      />
                      <SmallButton
                        onClick={() =>
                          chooseFile({
                            kind: 'replace',
                            assetId: leadingAsset.assetId,
                          })
                        }
                      >
                        Replace
                      </SmallButton>
                      <SmallButton
                        title="Remove this illustration from the lesson"
                        onClick={() => removeImageByAsset(leadingAsset.assetId)}
                      >
                        ✕
                      </SmallButton>
                    </ImageBar>
                  </ImageBox>
                )}

                {slide.kind === 'image' && isImageBlock(block) && (
                  <Note>
                    A standalone illustration card. Delete it and add the
                    picture inside a text slide to place it in the prose.
                  </Note>
                )}

                {isQuickChallengeBlock(block) && (
                  <>
                    <BodyArea
                      value={block.scenario}
                      rows={3}
                      placeholder="The scenario the question is about"
                      onChange={event =>
                        editBlock(slide.blockId, {
                          scenario: event.target.value,
                        } as never)
                      }
                    />
                    <Field>
                      <FieldLabel>LESSON-LIST PREVIEW</FieldLabel>
                      <SmallInput
                        value={block.questionPreview}
                        placeholder="One-line teaser shown before the lesson"
                        onChange={event =>
                          editBlock(slide.blockId, {
                            questionPreview: event.target.value,
                          } as never)
                        }
                      />
                    </Field>
                  </>
                )}

                {isCheckYourselfBlock(block) && (
                  <>
                    <Field>
                      <FieldLabel>CARD LABEL</FieldLabel>
                      <SmallInput
                        value={block.context}
                        placeholder="e.g. Recall · Yellow lines"
                        onChange={event =>
                          editBlock(slide.blockId, {
                            context: event.target.value,
                          } as never)
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel>
                        RULE — WRAP EACH HIDDEN WORD IN [[DOUBLE BRACKETS]]
                      </FieldLabel>
                      <BodyArea
                        value={block.ruleMarkdown}
                        rows={3}
                        onChange={event =>
                          editBlock(slide.blockId, {
                            ruleMarkdown: event.target.value,
                          } as never)
                        }
                      />
                    </Field>
                    {recallGapErrors(block.ruleMarkdown).map(error => (
                      <Warning key={error}>{error}</Warning>
                    ))}
                  </>
                )}

                {isText && block.type === 'remember_this' && (
                  <Note>
                    A recap is the line the learner carries away, so it is set
                    large. Write several paragraphs and, once there is enough
                    text to be a wall, each becomes its own card and the type
                    comes down; two short lines stay together.
                  </Note>
                )}

                {isText && (
                  <SlideBodyEditor
                    blockId={slide.blockId}
                    elements={blockElements(block)}
                    assets={assets}
                    onPickImage={chooseFile}
                  />
                )}

                {question != null && (
                  <QuestionEditor
                    question={question}
                    assets={assets}
                    onQuestion={next => editQuestion(next.questionId, next)}
                    onAssetAlt={setAssetAlt}
                    onPickPicture={() =>
                      chooseFile({
                        kind: 'question',
                        questionId: question.questionId,
                      })
                    }
                    onRemovePicture={() =>
                      clearQuestionPicture(question.questionId)
                    }
                    action={
                      <SmallButton
                        title="Ask a different question from the course pool on this slide"
                        onClick={() =>
                          setPicking({
                            blockId: slide.blockId,
                            slot: 'main',
                            current: question.questionId,
                          })
                        }
                      >
                        Change question…
                      </SmallButton>
                    }
                  />
                )}

                {isText &&
                  (checkpoint != null ? (
                    <>
                      <CheckpointHead>
                        <FieldLabel>FOLLOW-UP CHECKPOINT</FieldLabel>
                        <Spacer />
                        <SmallButton
                          title="Remove the checkpoint question after this slide"
                          onClick={() => setCheckpoint(slide.blockId, false)}
                        >
                          Remove checkpoint
                        </SmallButton>
                      </CheckpointHead>
                      <QuestionEditor
                        question={checkpoint}
                        assets={assets}
                        onQuestion={next => editQuestion(next.questionId, next)}
                        onAssetAlt={setAssetAlt}
                        onPickPicture={() =>
                          chooseFile({
                            kind: 'question',
                            questionId: checkpoint.questionId,
                          })
                        }
                        onRemovePicture={() =>
                          clearQuestionPicture(checkpoint.questionId)
                        }
                        action={
                          <SmallButton
                            title="Ask a different question from the course pool here"
                            onClick={() =>
                              setPicking({
                                blockId: slide.blockId,
                                slot: 'checkpoint',
                                current: checkpoint.questionId,
                              })
                            }
                          >
                            Change question…
                          </SmallButton>
                        }
                      />
                    </>
                  ) : (
                    <AddRow>
                      <DashedButton
                        title="Ask a question on its own card right after this slide"
                        onClick={() => setCheckpoint(slide.blockId, true)}
                      >
                        + Add checkpoint question
                      </DashedButton>
                    </AddRow>
                  ))}
              </Slide>

              <AddRow>
                {KINDS.map(kind => (
                  <DashedButton
                    key={kind}
                    title={`Insert a ${KIND_LABEL[
                      kind
                    ].toLowerCase()} slide after this one`}
                    onClick={() => addSlide(slide.blockId, kind)}
                  >
                    + {KIND_LABEL[kind]} slide
                  </DashedButton>
                ))}
              </AddRow>
            </React.Fragment>
          );
        })}
      </Slides>

      {picking != null && courseId != null && draftId != null && (
        <QuestionPicker
          courseId={courseId}
          draftId={draftId}
          lessonId={doc.lesson.lessonId}
          currentQuestionId={picking.current}
          onClose={() => setPicking(null)}
          onPick={(question, asset) =>
            setSlideQuestion(picking.blockId, picking.slot, question, asset)
          }
        />
      )}
    </Column>
  );
};

export default EditCardList;

const Column = styled.div`
  max-width: 680px;
  margin: 0 auto;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.4px;
`;

const Editing = styled.span`
  font-size: 11.5px;
  font-weight: 500;
  color: #b45309;
`;

const Spacer = styled.div`
  flex: 1;
`;

const Slides = styled.div`
  display: flex;
  flex-direction: column;
`;

const Slide = styled.div`
  background: ${admin.surface};
  border: 1px solid ${admin.line3};
  border-radius: 14px;
  padding: 17px 20px;
`;

const SlideHead = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
`;

const Index = styled.span`
  font: 600 10px ${admin.mono};
  color: ${admin.ghost};
`;

const Kicker = styled.span<{ $color: string }>`
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: ${({ $color }) => $color};
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 8px;
`;

const CheckpointHead = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
`;

const AddRow = styled.div`
  display: flex;
  gap: 6px;
  justify-content: center;
  padding: 7px 0;
  opacity: 0;
  transition: opacity 0.12s;

  &:hover,
  &:focus-within {
    opacity: 1;
  }
`;

const Note = styled.p`
  margin: 6px 0 0;
  font-size: 11.5px;
  font-weight: 500;
  color: ${admin.dim};
`;

const ImageBox = styled.div`
  margin-top: 9px;
  border: 1px solid ${admin.line3};
  border-radius: 11px;
  overflow: hidden;
`;

const ImagePreview = styled.div`
  aspect-ratio: 16 / 9;
  background: ${admin.hair};
  display: flex;

  svg {
    width: 100%;
    height: 100%;
  }
`;

const ImageBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-top: 1px solid ${admin.hair};
`;

const HiddenFile = styled.input`
  display: none;
`;

const PreviewImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
`;
