import { describe, it, expect } from 'vitest';
import { getEditorMode, MODE_CONFIG, LARGE_FILE_THRESHOLD } from './editorMode';

const MB = 1024 * 1024;

describe('editorMode', () => {
  describe('getEditorMode', () => {
    it('returns "full" for undefined size', () => {
      expect(getEditorMode(undefined)).toBe('full');
    });

    it('returns "full" for small files (< 10MB)', () => {
      expect(getEditorMode(0)).toBe('full');
      expect(getEditorMode(100)).toBe('full');
      expect(getEditorMode(MB)).toBe('full');
      expect(getEditorMode(9.9 * MB)).toBe('full');
    });

    it('returns "basic" for files between 10MB and 50MB', () => {
      expect(getEditorMode(10 * MB)).toBe('basic');
      expect(getEditorMode(25 * MB)).toBe('basic');
      expect(getEditorMode(49.9 * MB)).toBe('basic');
    });

    it('returns "highlight-only" for files between 50MB and 100MB', () => {
      expect(getEditorMode(50 * MB)).toBe('highlight-only');
      expect(getEditorMode(75 * MB)).toBe('highlight-only');
      expect(getEditorMode(99.9 * MB)).toBe('highlight-only');
    });

    it('returns "plaintext" for files >= 100MB', () => {
      expect(getEditorMode(100 * MB)).toBe('plaintext');
      expect(getEditorMode(500 * MB)).toBe('plaintext');
    });
  });

  describe('MODE_CONFIG', () => {
    it('has all four modes', () => {
      expect(Object.keys(MODE_CONFIG)).toEqual(['full', 'basic', 'highlight-only', 'plaintext']);
    });

    it('full mode has all features enabled', () => {
      const full = MODE_CONFIG.full;
      expect(full.enableLSP).toBe(true);
      expect(full.enableComplexAnalysis).toBe(true);
      expect(full.enableHighlight).toBe(true);
    });

    it('plaintext mode has all features disabled', () => {
      const plain = MODE_CONFIG.plaintext;
      expect(plain.enableLSP).toBe(false);
      expect(plain.enableComplexAnalysis).toBe(false);
      expect(plain.enableHighlight).toBe(false);
    });
  });

  describe('LARGE_FILE_THRESHOLD', () => {
    it('is 5MB', () => {
      expect(LARGE_FILE_THRESHOLD).toBe(5 * MB);
    });
  });
});