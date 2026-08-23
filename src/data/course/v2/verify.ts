// Client-side verification pipeline for downloaded course documents. Every
// byte fetched from the content server passes through here before it may
// enter an update plan: exact-size check, sha256 against the manifest ref,
// JSON parse, then full structural validation (schemaVersion, deliveryVersion,
// ids and references). A TypeScript cast is never the validation.

import { sha256Hex, utf8ByteLength } from '@/lib/sha256';

import type {
  CourseDocV2,
  DocumentRefV2,
  LessonDocV2,
  ModuleDocV2,
  ValidationResult,
} from './wire';
import {
  validateCourseDocV2,
  validateLessonDocV2,
  validateModuleDocV2,
} from './wire';

type DocKind = 'course' | 'module' | 'lesson';

const VALIDATORS: Record<
  DocKind,
  (
    input: unknown,
    expected: { deliveryVersion?: string },
  ) => ValidationResult<any>
> = {
  course: validateCourseDocV2,
  module: validateModuleDocV2,
  lesson: validateLessonDocV2,
};

const fail = <T>(errors: string[]): ValidationResult<T> => ({
  ok: false,
  value: null,
  errors,
});

const verifyBody = <T>(
  kind: DocKind,
  body: string,
  ref: DocumentRefV2,
  deliveryVersion: string,
): ValidationResult<T> => {
  const sizeBytes = utf8ByteLength(body);
  if (sizeBytes !== ref.sizeBytes) {
    return fail([
      `${kind} doc: size ${sizeBytes} does not match manifest ${ref.sizeBytes}`,
    ]);
  }
  const hash = sha256Hex(body);
  if (hash !== ref.sha256) {
    return fail([`${kind} doc: sha256 mismatch against manifest`]);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return fail([`${kind} doc: response body is not valid JSON`]);
  }
  return VALIDATORS[kind](parsed, { deliveryVersion });
};

export const verifyCourseDocBody = (
  body: string,
  ref: DocumentRefV2,
  deliveryVersion: string,
): ValidationResult<CourseDocV2> =>
  verifyBody<CourseDocV2>('course', body, ref, deliveryVersion);

export const verifyModuleDocBody = (
  body: string,
  ref: DocumentRefV2,
  deliveryVersion: string,
): ValidationResult<ModuleDocV2> =>
  verifyBody<ModuleDocV2>('module', body, ref, deliveryVersion);

export const verifyLessonDocBody = (
  body: string,
  ref: DocumentRefV2,
  deliveryVersion: string,
): ValidationResult<LessonDocV2> =>
  verifyBody<LessonDocV2>('lesson', body, ref, deliveryVersion);
