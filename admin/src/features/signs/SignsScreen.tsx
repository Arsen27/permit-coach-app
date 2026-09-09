import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';

import type { Sign, SignCategory, SignImageRef } from '@admin/api/types';
import { changedEntityCount, useSigns } from '@admin/store/signsStore';
import { useUi } from '@admin/store/uiStore';
import { admin } from '@admin/styles/theme';
import {
  BodyArea,
  FieldLabel,
  Select,
  SmallButton,
  SmallInput,
  Warning,
} from '@admin/features/editor/fields';
import {
  Chip,
  GhostButton,
  Mono,
  PrimaryButton,
  Row,
  SectionLabel,
  Spacer,
} from '@admin/features/shell/ui';

import {
  SIGN_CATEGORY_GLYPHS,
  SIGN_IMAGE_EXTENSIONS,
  SIGN_IMAGE_MIMES,
  signThumbRef,
  validateSignsDoc,
} from '@/data/signs/wire';

// The signs catalogue editor. Edit, Save, then publish to a channel; no
// drafts and no versions — a catalogue is named by the hash of its document,
// so rolling back is just publishing an earlier one.
// A sign's artwork is its uploaded picture, previewed at both the sizes the
// device actually uses.

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled';

type Selection =
  | { type: 'category'; id: string }
  | { type: 'sign'; id: string }
  | null;

const SignsScreen: React.FC = () => {
  const state = useSigns();
  const showToast = useUi(s => s.showToast);
  const [selection, setSelection] = useState<Selection>(null);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);

  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    void useSigns.getState().load();
    void useSigns.getState().loadChannels();
    void useSigns.getState().loadHistory();
  }, []);

  const doc = state.doc;
  const changed = changedEntityCount(state);
  const stagingSha = state.channels?.staging?.sha256 ?? null;
  const productionSha = state.channels?.production?.sha256 ?? null;

  // The contract's validator runs on every edit: the document is small, and an
  // author should see a problem the moment it exists, not at save time.
  const validation = useMemo(
    () => (doc == null ? null : validateSignsDoc(doc)),
    [doc],
  );

  if (state.loading && doc == null) {
    return (
      <Screen>
        <Note>loading signs…</Note>
      </Screen>
    );
  }
  if (state.error != null || doc == null) {
    return (
      <Screen>
        <Note>{state.error ?? 'No signs catalogue on the server yet.'}</Note>
      </Screen>
    );
  }

  const selectedCategory =
    selection?.type === 'category'
      ? doc.categories.find(c => c.id === selection.id)
      : undefined;
  const selectedSign =
    selection?.type === 'sign'
      ? doc.signs.find(s => s.id === selection.id)
      : undefined;

  // An id is only editable until it has been saved: a live id is referenced by
  // learners' bookmarks and by the generated `sq-<id>` question ids.
  const isUnsaved = (type: 'category' | 'sign', id: string): boolean =>
    state.saved == null ||
    (type === 'category'
      ? !state.saved.categories.some(c => c.id === id)
      : !state.saved.signs.some(s => s.id === id));

  const save = async () => {
    const errors = await state.save();
    setSaveErrors(errors ?? []);
    if (errors == null) {
      showToast('Signs saved');
    }
  };

  const addCategory = () => {
    state.mutate(next => {
      const id = uniqueId(
        'new-category',
        next.categories.map(c => c.id),
      );
      next.categories.push({
        id,
        name: 'New category',
        subtitle: 'subtitle',
        blurb: 'What this category covers.',
        color: '#C8102E',
        glyph: 'diamond',
      });
      setSelection({ type: 'category', id });
    });
  };

  const addSign = (categoryId: string) => {
    state.mutate(next => {
      const id = uniqueId(
        'new-sign',
        next.signs.map(s => s.id),
      );
      next.signs.push({
        id,
        categoryId,
        name: 'New sign',
        code: 'R0-0',
        description: 'What this sign means.',
        steps: ['What to do'],
        trap: 'The exam trap to watch for.',
        // Deliberately artwork-less: a sign is its picture, so the validator
        // blocks Save until one is uploaded and names the sign that needs it.
      } as Sign);
      setSelection({ type: 'sign', id });
    });
  };

  const blocked = validation != null && !validation.ok;

  return (
    <Screen>
      <ListColumn>
        <ListHeader>
          <SectionLabel>Signs catalogue</SectionLabel>
          <Mono $size={11}>
            {doc.signs.length} signs · {doc.categories.length} categories
          </Mono>
        </ListHeader>
        <List>
          {doc.categories.map(category => (
            <React.Fragment key={category.id}>
              <CategoryRow
                $active={
                  selection?.type === 'category' && selection.id === category.id
                }
                onClick={() =>
                  setSelection({ type: 'category', id: category.id })
                }
              >
                <Swatch style={{ background: category.color }} />
                <span>{category.name}</span>
                <Spacer />
                <Mono $size={10}>
                  {doc.signs.filter(s => s.categoryId === category.id).length}
                </Mono>
              </CategoryRow>
              {doc.signs
                .filter(sign => sign.categoryId === category.id)
                .map(sign => (
                  <SignRow
                    key={sign.id}
                    $active={
                      selection?.type === 'sign' && selection.id === sign.id
                    }
                    onClick={() => setSelection({ type: 'sign', id: sign.id })}
                  >
                    <Thumb>
                      <SignThumb sign={sign} size={22} />
                    </Thumb>
                    <span>{sign.name}</span>
                    <Spacer />
                    <Mono $size={10}>{sign.code}</Mono>
                  </SignRow>
                ))}
              <AddRow onClick={() => addSign(category.id)}>+ sign</AddRow>
            </React.Fragment>
          ))}
          <AddRow onClick={addCategory}>+ category</AddRow>
        </List>
      </ListColumn>

      <Main>
        <Toolbar $gap={8}>
          <Mono $size={12}>
            {changed === 0 ? 'no unsaved changes' : `${changed} changed`}
          </Mono>
          <Chip $color="#6D28D9" $bg="rgba(124,58,237,.12)">
            staging {stagingSha?.slice(0, 8) ?? '—'}
          </Chip>
          <Chip $color="#1D4ED8" $bg="rgba(37,99,235,.12)">
            prod {productionSha?.slice(0, 8) ?? '—'}
          </Chip>
          {blocked && (
            <Chip $color={admin.status.draft.col} $bg={admin.status.draft.bg}>
              {validation.errors.length} problem
              {validation.errors.length === 1 ? '' : 's'}
            </Chip>
          )}
          <Spacer />
          <GhostButton
            aria-expanded={historyOpen}
            title="Every publish, newest first — roll a channel back from here"
            onClick={() => setHistoryOpen(current => !current)}
          >
            History
          </GhostButton>
          <GhostButton
            disabled={changed === 0}
            onClick={() => {
              state.revert();
              setSaveErrors([]);
              showToast('Reverted to the saved catalogue');
            }}
          >
            Revert
          </GhostButton>
          <GhostButton
            disabled={changed > 0}
            title={
              changed > 0
                ? 'Save first — publishing snapshots the saved catalogue'
                : 'Point staging at the saved catalogue'
            }
            onClick={() => {
              void state
                .publish('staging')
                .then(result => showToast(result.detail));
            }}
          >
            Publish to staging
          </GhostButton>
          <GhostButton
            disabled={stagingSha == null || stagingSha === productionSha}
            title={
              stagingSha == null
                ? 'Nothing on staging yet'
                : 'Everyone gets what staging is serving'
            }
            onClick={() => {
              if (
                stagingSha == null ||
                !window.confirm(
                  `Publish ${stagingSha.slice(
                    0,
                    12,
                  )} to production? Every install downloads it on its next open.`,
                )
              ) {
                return;
              }
              void state
                .publish('production', stagingSha)
                .then(result => showToast(result.detail));
            }}
          >
            Publish to production
          </GhostButton>
          <PrimaryButton
            disabled={state.saving || blocked || changed === 0}
            onClick={() => void save()}
          >
            {state.saving ? 'Saving…' : 'Save'}
          </PrimaryButton>
        </Toolbar>

        {historyOpen && (
          <History data-signs-history>
            {state.history == null ? (
              <Note>loading history…</Note>
            ) : state.history.length === 0 ? (
              <Note>Nothing published yet.</Note>
            ) : (
              state.history.map((move, index) => (
                <HistoryRow key={index} data-signs-history-row>
                  <Chip
                    $color={move.channel === 'production' ? '#1D4ED8' : '#6D28D9'}
                    $bg={
                      move.channel === 'production'
                        ? 'rgba(37,99,235,.12)'
                        : 'rgba(124,58,237,.12)'
                    }
                  >
                    {move.channel}
                  </Chip>
                  <Mono $size={11} $weight={600}>
                    {move.from?.slice(0, 8) ?? '—'} → {move.to.slice(0, 8)}
                  </Mono>
                  <Mono $size={10}>
                    {move.actor} · {new Date(move.at).toLocaleString()}
                  </Mono>
                  <Spacer />
                  <SmallButton
                    disabled={stagingSha === move.to}
                    title="Point staging at this catalogue"
                    onClick={() => {
                      void state
                        .publish('staging', move.to)
                        .then(result => showToast(result.detail));
                    }}
                  >
                    Staging ← this
                  </SmallButton>
                  <SmallButton
                    disabled={productionSha === move.to}
                    title="Point production at this catalogue"
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Point production at ${move.to.slice(
                            0,
                            12,
                          )}? Every install downloads it on its next open.`,
                        )
                      ) {
                        return;
                      }
                      void state
                        .publish('production', move.to)
                        .then(result => showToast(result.detail));
                    }}
                  >
                    Production ← this
                  </SmallButton>
                </HistoryRow>
              ))
            )}
          </History>
        )}

        {saveErrors.length > 0 && (
          <Problems>
            {saveErrors.map(error => (
              <Warning key={error}>{error}</Warning>
            ))}
          </Problems>
        )}
        {blocked && (
          <Problems>
            {validation.errors.map(error => (
              <Warning key={error}>{error}</Warning>
            ))}
          </Problems>
        )}

        {selectedSign != null ? (
          <SignEditor
            sign={selectedSign}
            categories={doc.categories}
            idEditable={isUnsaved('sign', selectedSign.id)}
            onChange={(mutator: (sign: Sign) => void) =>
              state.mutate(next => {
                const target = next.signs.find(s => s.id === selectedSign.id);
                if (target != null) mutator(target);
              })
            }
            onChangeId={nextId =>
              state.mutate(next => {
                const target = next.signs.find(s => s.id === selectedSign.id);
                if (target != null) target.id = nextId;
                setSelection({ type: 'sign', id: nextId });
              })
            }
            onDelete={() =>
              state.mutate(next => {
                next.signs = next.signs.filter(s => s.id !== selectedSign.id);
                setSelection(null);
              })
            }
          />
        ) : selectedCategory != null ? (
          <CategoryEditor
            category={selectedCategory}
            idEditable={isUnsaved('category', selectedCategory.id)}
            signCount={
              doc.signs.filter(s => s.categoryId === selectedCategory.id).length
            }
            onChange={(mutator: (category: SignCategory) => void) =>
              state.mutate(next => {
                const target = next.categories.find(
                  c => c.id === selectedCategory.id,
                );
                if (target != null) mutator(target);
              })
            }
            onChangeId={nextId =>
              state.mutate(next => {
                const target = next.categories.find(
                  c => c.id === selectedCategory.id,
                );
                if (target != null) {
                  // Signs point at the category by id, so they move with it.
                  for (const sign of next.signs) {
                    if (sign.categoryId === target.id) sign.categoryId = nextId;
                  }
                  target.id = nextId;
                }
                setSelection({ type: 'category', id: nextId });
              })
            }
            onDelete={() =>
              state.mutate(next => {
                next.categories = next.categories.filter(
                  c => c.id !== selectedCategory.id,
                );
                setSelection(null);
              })
            }
          />
        ) : (
          <Note>Select a category or a sign on the left.</Note>
        )}
      </Main>
    </Screen>
  );
};

// The asset URL the device will use. Content-addressed, so it is stable and
// the browser caches it exactly as the app does.
const assetUrl = (ref: SignImageRef): string =>
  `/v1/signs/assets/${ref.assetId}.${SIGN_IMAGE_EXTENSIONS[ref.mime]}`;

// What a surface actually shows, picking the same slot the app would.
const SignThumb: React.FC<{
  sign: Sign;
  size: number;
  variant?: 'thumb' | 'full';
}> = ({ sign, size, variant = 'thumb' }) => {
  // A sign that was just added has no picture yet — reading one crashed the
  // whole screen the moment "+ sign" was pressed, editor and all.
  if (sign.image == null) {
    return (
      <EmptyThumb
        style={{ width: size, height: size }}
        title="No artwork yet"
        aria-label={`${sign.name}: no artwork yet`}
      />
    );
  }
  const ref = variant === 'full' ? sign.image.full : signThumbRef(sign.image);
  return (
    <img
      src={assetUrl(ref)}
      width={size}
      height={size}
      alt={sign.name}
      style={{ objectFit: 'contain' }}
    />
  );
};

const History = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0 0 10px;
  padding: 8px 10px;
  border: 1px solid ${admin.line2};
  border-radius: 10px;
  background: ${admin.soft};
`;

const HistoryRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
`;

const EmptyThumb = styled.div`
  flex: none;
  border-radius: 6px;
  border: 1px dashed ${admin.line};
  background: ${admin.surface};
`;

const uniqueId = (base: string, taken: string[]): string => {
  const set = new Set(taken);
  if (!set.has(base)) return base;
  let index = 2;
  while (set.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
};

// ---------------------------------------------------------------------------
// Image slot
//
// One upload target. The server hashes the bytes and returns the reference the
// document must carry, so the panel never invents an asset id. Clearing the
// detail image clears the whole picture — a thumbnail with nothing behind it
// is not a state the contract allows.

type ImageSlotProps = {
  label: string;
  slot: 'full' | 'thumb';
  sign: Sign;
  onChange: (mutator: (sign: Sign) => void) => void;
};

const ImageSlot: React.FC<ImageSlotProps> = ({
  label,
  slot,
  sign,
  onChange,
}) => {
  const uploadAsset = useSigns(s => s.upload);
  const uploading = useSigns(s => s.uploading);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const current =
    slot === 'full' ? sign.image?.full ?? null : sign.image?.thumb ?? null;
  // A thumbnail cannot stand in for a missing detail image.
  const disabled = slot === 'thumb' && sign.image?.full == null;

  const pick = async (file: File) => {
    setErrors([]);
    const result = await uploadAsset(file);
    if (Array.isArray(result)) {
      setErrors(result);
      return;
    }
    onChange(target => {
      if (slot === 'full') {
        target.image = { ...(target.image ?? {}), full: result };
      } else if (target.image?.full != null) {
        target.image = { ...target.image, thumb: result };
      }
    });
  };

  // Only the thumbnail can be cleared: a sign without a detail image has no
  // artwork at all, which the contract does not allow.
  const clear = () =>
    onChange(target => {
      const { thumb: _dropped, ...rest } = target.image;
      target.image = rest;
    });

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <SlotBox $empty={current == null}>
        {current != null ? (
          <img
            src={assetUrl(current)}
            alt={label}
            style={{ maxWidth: 64, maxHeight: 64, objectFit: 'contain' }}
          />
        ) : (
          <Mono $size={11}>
            {disabled ? 'add a detail image first' : 'required — upload one'}
          </Mono>
        )}
        <Spacer />
        <Row $gap={6}>
          <SmallButton
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? 'Uploading…' : current == null ? 'Upload' : 'Replace'}
          </SmallButton>
          {current != null && slot === 'thumb' && (
            <SmallButton onClick={clear}>Remove</SmallButton>
          )}
        </Row>
      </SlotBox>
      {current != null && (
        <Mono $size={10}>
          {SIGN_IMAGE_EXTENSIONS[current.mime]} ·{' '}
          {Math.max(1, Math.round(current.sizeBytes / 1024))}KB
        </Mono>
      )}
      {errors.map(error => (
        <Warning key={error}>{error}</Warning>
      ))}
      <HiddenFileInput
        ref={inputRef}
        type="file"
        accept={SIGN_IMAGE_MIMES.join(',')}
        onChange={event => {
          const file = event.target.files?.[0];
          // Reset so re-picking the same file fires change again.
          event.target.value = '';
          if (file != null) void pick(file);
        }}
      />
    </Field>
  );
};

// ---------------------------------------------------------------------------
// Sign editor

type SignEditorProps = {
  sign: Sign;
  categories: SignCategory[];
  idEditable: boolean;
  onChange: (mutator: (sign: Sign) => void) => void;
  onChangeId: (next: string) => void;
  onDelete: () => void;
};

const SignEditor: React.FC<SignEditorProps> = ({
  sign,
  categories,
  idEditable,
  onChange,
  onChangeId,
  onDelete,
}) => {
  return (
    <Editor>
      <PreviewRow>
        <Preview>
          <SignThumb sign={sign} size={150} variant="full" />
          <PreviewLabel>detail</PreviewLabel>
        </Preview>
        <Preview>
          <SignThumb sign={sign} size={52} />
          <PreviewLabel>grid &amp; quiz</PreviewLabel>
        </Preview>
      </PreviewRow>

      <Grid>
        <Field>
          <FieldLabel>id</FieldLabel>
          <SmallInput
            value={sign.id}
            disabled={!idEditable}
            onChange={e => onChangeId(slugify(e.target.value))}
          />
        </Field>
        <Field>
          <FieldLabel>category</FieldLabel>
          <Select
            value={sign.categoryId}
            onChange={e => onChange(s => void (s.categoryId = e.target.value))}
          >
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <FieldLabel>name</FieldLabel>
          <SmallInput
            value={sign.name}
            onChange={e => onChange(s => void (s.name = e.target.value))}
          />
        </Field>
        <Field>
          <FieldLabel>MUTCD code</FieldLabel>
          <SmallInput
            value={sign.code}
            onChange={e => onChange(s => void (s.code = e.target.value))}
          />
        </Field>
      </Grid>

      <Field>
        <FieldLabel>description</FieldLabel>
        <BodyArea
          rows={3}
          value={sign.description}
          onChange={e => onChange(s => void (s.description = e.target.value))}
        />
      </Field>
      <Field>
        <FieldLabel>steps — one per line</FieldLabel>
        <BodyArea
          rows={3}
          value={sign.steps.join('\n')}
          onChange={e =>
            onChange(s => void (s.steps = e.target.value.split('\n')))
          }
        />
      </Field>
      <Field>
        <FieldLabel>exam trap</FieldLabel>
        <BodyArea
          rows={2}
          value={sign.trap}
          onChange={e => onChange(s => void (s.trap = e.target.value))}
        />
      </Field>

      <SectionLabel>artwork</SectionLabel>
      <ImageHint>
        The detail image is what the sign screen shows. The thumbnail is
        optional — without one the detail image is used at thumbnail size. SVG,
        PNG or JPEG, up to 2MB.
      </ImageHint>
      <Grid>
        <ImageSlot
          label="detail image"
          slot="full"
          sign={sign}
          onChange={onChange}
        />
        <ImageSlot
          label="thumbnail (optional)"
          slot="thumb"
          sign={sign}
          onChange={onChange}
        />
      </Grid>

      <Row $gap={8}>
        <Spacer />
        <SmallButton onClick={onDelete}>Delete sign</SmallButton>
      </Row>
    </Editor>
  );
};

// ---------------------------------------------------------------------------
// Category editor

type CategoryEditorProps = {
  category: SignCategory;
  idEditable: boolean;
  signCount: number;
  onChange: (mutator: (category: SignCategory) => void) => void;
  onChangeId: (next: string) => void;
  onDelete: () => void;
};

const CategoryEditor: React.FC<CategoryEditorProps> = ({
  category,
  idEditable,
  signCount,
  onChange,
  onChangeId,
  onDelete,
}) => (
  <Editor>
    <Grid>
      <Field>
        <FieldLabel>id</FieldLabel>
        <SmallInput
          value={category.id}
          disabled={!idEditable}
          onChange={e => onChangeId(slugify(e.target.value))}
        />
      </Field>
      <Field>
        <FieldLabel>name</FieldLabel>
        <SmallInput
          value={category.name}
          onChange={e => onChange(c => void (c.name = e.target.value))}
        />
      </Field>
      <Field>
        <FieldLabel>subtitle</FieldLabel>
        <SmallInput
          value={category.subtitle}
          onChange={e => onChange(c => void (c.subtitle = e.target.value))}
        />
      </Field>
      <Field>
        <FieldLabel>colour</FieldLabel>
        <Row $gap={6}>
          <ColorInput
            type="color"
            value={
              /^#[0-9A-Fa-f]{6}$/.test(category.color)
                ? category.color
                : '#C8102E'
            }
            onChange={e =>
              onChange(c => void (c.color = e.target.value.toUpperCase()))
            }
          />
          <SmallInput
            value={category.color}
            onChange={e => onChange(c => void (c.color = e.target.value))}
          />
        </Row>
      </Field>
      <Field>
        <FieldLabel>glyph</FieldLabel>
        <Select
          value={category.glyph}
          onChange={e =>
            onChange(
              c => void (c.glyph = e.target.value as SignCategory['glyph']),
            )
          }
        >
          {SIGN_CATEGORY_GLYPHS.map(glyph => (
            <option key={glyph} value={glyph}>
              {glyph}
            </option>
          ))}
        </Select>
      </Field>
    </Grid>
    <Field>
      <FieldLabel>blurb</FieldLabel>
      <BodyArea
        rows={2}
        value={category.blurb}
        onChange={e => onChange(c => void (c.blurb = e.target.value))}
      />
    </Field>
    <Row $gap={8}>
      {signCount > 0 && (
        <Mono $size={11}>
          {signCount} sign{signCount === 1 ? '' : 's'} — move them before
          deleting
        </Mono>
      )}
      <Spacer />
      <SmallButton onClick={onDelete}>Delete category</SmallButton>
    </Row>
  </Editor>
);

export default SignsScreen;

// ---------------------------------------------------------------------------
// Chrome

const Screen = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
`;

const ListColumn = styled.div`
  width: 300px;
  flex-shrink: 0;
  border-right: 1px solid ${admin.line};
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

const ListHeader = styled.div`
  padding: 16px 16px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const List = styled.div`
  flex: 1;
  overflow: auto;
  padding-bottom: 40px;
`;

const CategoryRow = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 16px;
  border: 0;
  background: ${({ $active }) => ($active ? admin.soft : 'transparent')};
  color: ${admin.strong};
  font: 700 12.5px ${admin.sans};
  cursor: pointer;
  text-align: left;
`;

const SignRow = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 5px 16px 5px 26px;
  border: 0;
  background: ${({ $active }) => ($active ? admin.soft : 'transparent')};
  color: ${admin.body};
  font: 500 12.5px ${admin.sans};
  cursor: pointer;
  text-align: left;
`;

const AddRow = styled.button`
  display: block;
  width: 100%;
  padding: 5px 16px 5px 26px;
  border: 0;
  background: transparent;
  color: ${admin.accent};
  font: 600 12px ${admin.sans};
  cursor: pointer;
  text-align: left;
`;

const Thumb = styled.span`
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const Swatch = styled.span`
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
`;

const Main = styled.div`
  flex: 1;
  min-width: 0;
  overflow: auto;
  padding: 18px 26px 70px;
`;

const Toolbar = styled(Row)`
  margin-bottom: 16px;
`;

const Editor = styled.div`
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const PreviewRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 12px;
`;

const PreviewLabel = styled.span`
  font: 600 10px ${admin.sans};
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: ${admin.dim};
`;

const SlotBox = styled.div<{ $empty: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 74px;
  padding: 8px 10px;
  border: 1px ${({ $empty }) => ($empty ? 'dashed' : 'solid')} ${admin.line};
  border-radius: 10px;
  background: ${admin.surface};
`;

const HiddenFileInput = styled.input`
  display: none;
`;

const ImageHint = styled.p`
  margin: -6px 0 0;
  font: 500 11.5px ${admin.sans};
  color: ${admin.muted};
`;

const Preview = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  align-self: flex-start;
  padding: 18px 26px;
  border: 1px solid ${admin.line};
  border-radius: 12px;
  background: ${admin.surface};
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 14px;
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ColorInput = styled.input`
  width: 34px;
  height: 26px;
  padding: 0;
  border: 1px solid ${admin.line};
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
`;

const Problems = styled.div`
  margin-bottom: 14px;
`;

const Note = styled.p`
  margin: 40px auto;
  color: ${admin.muted};
  font: 500 13px ${admin.sans};
`;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 18, 24, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
`;

const Dialog = styled.div`
  width: 440px;
  background: ${admin.surface};
  border-radius: 14px;
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
`;

const DialogTitle = styled.h3`
  margin: 0;
  font: 800 15px ${admin.sans};
  color: ${admin.strong};
`;

const DialogNote = styled.p`
  margin: 0;
  font: 500 12.5px ${admin.sans};
  color: ${admin.muted};
`;

const DiffSummary = styled.pre`
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: ${admin.soft};
  color: ${admin.body};
  font: 500 11.5px ${admin.mono};
  max-height: 160px;
  overflow: auto;
  white-space: pre-wrap;
`;
