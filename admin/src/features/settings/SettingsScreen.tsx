import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

import { adminApi } from '@admin/api/adminApi';
import { ApiError } from '@admin/api/client';
import type { AdminSettings, AppReleaseSettings } from '@admin/api/types';
import {
  PrimaryButton,
  SectionLabel,
  Segmented,
  SegmentedItem,
  Spacer,
  Switch,
} from '@admin/features/shell/ui';
import { useUi } from '@admin/store/uiStore';
import { useWorkspace } from '@admin/store/workspaceStore';
import { admin } from '@admin/styles/theme';

// Workspace defaults. Provider keys are never entered here — they live in the
// server environment and are only reported as configured or not.

// The app-release gate the server hands every device: the oldest build still
// allowed to download courses, and the newest store build per platform so the
// app can point at the listing. Kept on the server so a store release never
// needs a deploy.
const AppReleaseGroup: React.FC = () => {
  const showToast = useUi(state => state.showToast);
  const [form, setForm] = useState<AppReleaseSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .appRelease()
      .then(setForm)
      .catch(caught => setError((caught as Error).message));
  }, []);

  if (form == null) {
    return (
      <Group>
        <Row>
          <RowSub>{error ?? 'Loading…'}</RowSub>
        </Row>
      </Group>
    );
  }

  const field = (
    title: string,
    sub: string,
    value: string,
    onChange: (next: string) => void,
    placeholder = '',
  ) => (
    <Row>
      <RowText>
        <RowTitle>{title}</RowTitle>
        <RowSub>{sub}</RowSub>
      </RowText>
      <TextInput
        value={value}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value)}
      />
    </Row>
  );

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const saved = await adminApi.saveAppRelease({
        minSupportedAppVersion: form.minSupportedAppVersion,
        ios: form.ios,
        android: form.android,
      });
      setForm(saved);
      showToast('App releases saved');
    } catch (caught) {
      const failure = caught as ApiError;
      setError(failure.errors?.join('; ') ?? failure.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Group>
      {field(
        'Minimum supported app',
        'Older builds download nothing and are told to update',
        form.minSupportedAppVersion,
        next => setForm({ ...form, minSupportedAppVersion: next }),
      )}
      <Divider />
      {field(
        'iOS — latest version',
        'The build the App Store currently offers',
        form.ios.latestVersion,
        next => setForm({ ...form, ios: { ...form.ios, latestVersion: next } }),
      )}
      {field(
        'iOS — store URL',
        'Empty hides the update prompt on iOS',
        form.ios.storeUrl,
        next => setForm({ ...form, ios: { ...form.ios, storeUrl: next } }),
        'https://apps.apple.com/…',
      )}
      <Divider />
      {field(
        'Android — latest version',
        'The build Google Play currently offers',
        form.android.latestVersion,
        next =>
          setForm({
            ...form,
            android: { ...form.android, latestVersion: next },
          }),
      )}
      {field(
        'Android — store URL',
        'Empty hides the update prompt on Android',
        form.android.storeUrl,
        next =>
          setForm({ ...form, android: { ...form.android, storeUrl: next } }),
        'https://play.google.com/…',
      )}
      {error != null && (
        <Row>
          <ErrorText>{error}</ErrorText>
        </Row>
      )}
      <Row>
        <RowSub>
          {form.updatedBy.length > 0
            ? `Last saved by ${form.updatedBy}`
            : 'Not set yet'}
        </RowSub>
        <Spacer />
        <PrimaryButton disabled={busy} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save app releases'}
        </PrimaryButton>
      </Row>
    </Group>
  );
};

const SettingsScreen: React.FC = () => {
  const settings = useWorkspace(state => state.settings);
  const courses = useWorkspace(state => state.courses);
  const providers = useWorkspace(state => state.providers);
  const save = useWorkspace(state => state.saveSettings);
  const selectCourse = useWorkspace(state => state.selectCourse);
  const showToast = useUi(state => state.showToast);

  if (settings == null) {
    return null;
  }

  const update = async (patch: Partial<AdminSettings>) => {
    await save(patch);
    showToast('Settings saved');
  };

  const toggle = (key: keyof AdminSettings, title: string, sub: string) => (
    <Row key={key}>
      <RowText>
        <RowTitle>{title}</RowTitle>
        <RowSub>{sub}</RowSub>
      </RowText>
      <Switch
        $on={Boolean(settings[key])}
        onClick={() =>
          void update({ [key]: !settings[key] } as Partial<AdminSettings>)
        }
      />
    </Row>
  );

  const activeProvider = providers.find(
    provider => provider.id === settings.llmProvider,
  );

  return (
    <Screen>
      <Column>
        <Title>Settings</Title>
        <Intro>Workspace-level defaults for the content admin.</Intro>

        <SectionLabel>Course</SectionLabel>
        <Group>
          <Row>
            <RowText>
              <RowTitle>Course name</RowTitle>
              <RowSub>
                Shown in the admin header and in the prompt builder
              </RowSub>
            </RowText>
            <TextInput
              defaultValue={settings.courseName}
              onBlur={event => {
                if (event.target.value !== settings.courseName) {
                  void update({ courseName: event.target.value });
                }
              }}
            />
          </Row>
          <Divider />
          <Row>
            <RowText>
              <RowTitle>Default state</RowTitle>
              <RowSub>
                Each state is its own course tree — this one opens first
              </RowSub>
            </RowText>
            <Segmented>
              {courses.map(course => (
                <SegmentedItem
                  key={course.courseId}
                  $active={course.usState === settings.defaultState}
                  onClick={() => {
                    void update({ defaultState: course.usState });
                    void selectCourse(course.courseId);
                  }}
                >
                  {course.usState}
                </SegmentedItem>
              ))}
            </Segmented>
          </Row>
        </Group>

        <SectionLabel>Publishing</SectionLabel>
        <Group>
          {toggle(
            'autoBump',
            'Auto-bump minor version',
            'New drafts are offered the next free x.y.0 number',
          )}
          <Divider />
          {toggle(
            'requireChangeNote',
            'Require change note',
            'A draft cannot be released without a changelog entry',
          )}
          <Divider />
          {toggle(
            'reviewBeforeRelease',
            'Review before release',
            'A second admin must approve every release',
          )}
        </Group>

        <SectionLabel>Editor</SectionLabel>
        <Group>
          {toggle(
            'diffOnByDefault',
            'Diff on by default',
            'Turn the word-level diff on whenever Compare opens',
          )}
          <Divider />
          {toggle(
            'autosaveDrafts',
            'Autosave drafts',
            'Save edits to the draft as you type',
          )}
          <Divider />
          {toggle(
            'spellCheck',
            'Spell check in editor',
            'Underline misspellings while editing lesson text',
          )}
        </Group>

        <SectionLabel>AI assistance</SectionLabel>
        <Group>
          <Row>
            <RowText>
              <RowTitle>Provider</RowTitle>
              <RowSub>
                Used by Find similar. Keys live in the server environment, never
                in the panel.
              </RowSub>
            </RowText>
            <Segmented>
              {providers.map(provider => (
                <SegmentedItem
                  key={provider.id}
                  $active={provider.id === settings.llmProvider}
                  onClick={() =>
                    void update({
                      llmProvider: provider.id,
                      llmModel: provider.models[0],
                    })
                  }
                >
                  {provider.id}
                </SegmentedItem>
              ))}
            </Segmented>
          </Row>
          <Divider />
          <Row>
            <RowText>
              <RowTitle>Model</RowTitle>
              <RowSub>
                {activeProvider?.configured === true
                  ? 'API key detected — searches are ranked by this model'
                  : `No API key for ${settings.llmProvider} — searches fall back to word overlap`}
              </RowSub>
            </RowText>
            <Select
              value={settings.llmModel}
              onChange={event => void update({ llmModel: event.target.value })}
            >
              {(activeProvider?.models ?? []).map(model => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </Select>
          </Row>
        </Group>

        <SectionLabel>App releases</SectionLabel>
        <AppReleaseGroup />
      </Column>
    </Screen>
  );
};

export default SettingsScreen;

const Screen = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 28px 30px 70px;
`;

const Column = styled.div`
  max-width: 660px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Title = styled.h2`
  margin: 0 0 4px;
  font-size: 21px;
  font-weight: 800;
  letter-spacing: -0.4px;
`;

const Intro = styled.p`
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.6;
  font-weight: 500;
  color: ${admin.dim};
`;

const Group = styled.div`
  background: ${admin.surface};
  border: 1px solid ${admin.line3};
  border-radius: 14px;
  padding: 6px 0;
  margin-bottom: 14px;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 18px;
`;

const RowText = styled.div`
  flex: 1;
`;

const RowTitle = styled.span`
  display: block;
  font-size: 12.5px;
  font-weight: 700;
  color: ${admin.ink};
`;

const RowSub = styled.span`
  font-size: 11px;
  line-height: 1.5;
  font-weight: 500;
  color: ${admin.dim2};
`;

const Divider = styled.div`
  height: 1px;
  background: ${admin.hair};
  margin: 0 18px;
`;

const ErrorText = styled.span`
  font-size: 11.5px;
  font-weight: 600;
  color: #b91c1c;
`;

const TextInput = styled.input`
  width: 220px;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  color: ${admin.ink};
  border: 1px solid ${admin.line};
  border-radius: 9px;
  padding: 8px 11px;
  outline: none;

  &:focus {
    border-color: ${admin.accent};
  }
`;

const Select = styled.select`
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  color: ${admin.ink};
  border: 1px solid ${admin.line};
  border-radius: 9px;
  padding: 7px 10px;
  outline: none;
  background: ${admin.surface};

  &:focus {
    border-color: ${admin.accent};
  }
`;
