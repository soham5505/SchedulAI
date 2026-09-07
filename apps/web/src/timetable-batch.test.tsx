/**
 * timetable-batch.test.tsx
 *
 * Tests for batch-aware TimetableCard display and the client-side
 * batch filter logic used in TimetablePage.
 *
 * All fixtures are generic — no hard-coded B1/B2/B3 or real data.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import type { ITimetableEntry, IBatch } from '@schedulai/shared-types';

// ---------------------------------------------------------------------------
// Minimal TimetableCard extracted for unit testing
// (Mirrors the real card but without the DnD context requirement.)
// ---------------------------------------------------------------------------

interface MiniCardProps {
    entry: ITimetableEntry;
}

const MiniTimetableCard: React.FC<MiniCardProps> = ({ entry }) => {
    const subject = entry.subjectId as unknown as { name?: string };
    const teacher = entry.teacherId as unknown as { name?: string };
    const classroom = entry.classroomId as unknown as { building?: string; roomNumber?: string };
    const batch = entry.batchId as unknown as { code?: string } | null | undefined;
    const batchLabel = batch?.code ?? 'ALL';

    return (
        <div data-testid="timetable-card">
            <span data-testid="subject">{subject?.name ?? 'Subject'}</span>
            <span data-testid="batch">{batchLabel}</span>
            <span data-testid="teacher">{teacher?.name ?? 'Teacher'}</span>
            <span data-testid="room">
                {classroom?.building ? `${classroom.building} - ${classroom.roomNumber}` : 'Room'}
            </span>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<ITimetableEntry> = {}): ITimetableEntry {
    return {
        _id: 'entry-1',
        day: 'MONDAY',
        startTime: '09:00',
        endTime: '10:00',
        periodType: 'LECTURE',
        generationId: 'gen-1',
        semesterId: { _id: 'sem-1', name: 'Semester V', section: 'A' } as unknown as string,
        subjectId: { _id: 'sub-1', name: 'Generic Subject', code: 'GS101' } as unknown as string,
        teacherId: { _id: 'tch-1', name: 'Faculty Alpha' } as unknown as string,
        classroomId: { _id: 'room-1', building: 'Block X', roomNumber: '101', name: 'Lab 1' } as unknown as string,
        timeSlotId: 'slot-1',
        batchId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
    };
}

function makeBatch(code: string, semId = 'sem-1'): IBatch {
    return {
        _id: `batch-${code}`,
        code,
        semesterId: semId,
        studentCount: 30,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

// ---------------------------------------------------------------------------
// PART A — TimetableCard batch display
// ---------------------------------------------------------------------------

describe('TimetableCard — batch display', () => {
    it('shows the batch code when batchId is a populated object', () => {
        const batch = makeBatch('GRP-A');
        const entry = makeEntry({ batchId: batch as unknown as string });
        render(<MiniTimetableCard entry={entry} />);
        expect(screen.getByTestId('batch').textContent).toBe('GRP-A');
    });

    it('shows ALL when batchId is null (whole-class assignment)', () => {
        const entry = makeEntry({ batchId: null });
        render(<MiniTimetableCard entry={entry} />);
        expect(screen.getByTestId('batch').textContent).toBe('ALL');
    });

    it('shows ALL when batchId is undefined (legacy entry — no batch field)', () => {
        const entry = makeEntry();
        delete (entry as unknown as Record<string, unknown>)['batchId'];
        render(<MiniTimetableCard entry={entry} />);
        expect(screen.getByTestId('batch').textContent).toBe('ALL');
    });

    it('shows subject name correctly', () => {
        const entry = makeEntry();
        render(<MiniTimetableCard entry={entry} />);
        expect(screen.getByTestId('subject').textContent).toBe('Generic Subject');
    });

    it('shows teacher name correctly', () => {
        const entry = makeEntry();
        render(<MiniTimetableCard entry={entry} />);
        expect(screen.getByTestId('teacher').textContent).toBe('Faculty Alpha');
    });

    it('shows room correctly', () => {
        const entry = makeEntry();
        render(<MiniTimetableCard entry={entry} />);
        expect(screen.getByTestId('room').textContent).toBe('Block X - 101');
    });

    it('two cards with different batches each display their own batch, faculty, and room independently', () => {
        const batchOne = makeBatch('GRP-1');
        const batchTwo = makeBatch('GRP-2');

        const entryOne = makeEntry({
            _id: 'e1',
            batchId: batchOne as unknown as string,
            teacherId: { _id: 'tch-1', name: 'Faculty Alpha' } as unknown as string,
            classroomId: { _id: 'room-1', building: 'Block X', roomNumber: '101', name: 'Lab 1' } as unknown as string,
        });

        const entryTwo = makeEntry({
            _id: 'e2',
            batchId: batchTwo as unknown as string,
            teacherId: { _id: 'tch-2', name: 'Faculty Beta' } as unknown as string,
            classroomId: { _id: 'room-2', building: 'Block Y', roomNumber: '202', name: 'Lab 2' } as unknown as string,
        });

        const { rerender } = render(<MiniTimetableCard entry={entryOne} />);
        expect(screen.getByTestId('batch').textContent).toBe('GRP-1');
        expect(screen.getByTestId('teacher').textContent).toBe('Faculty Alpha');
        expect(screen.getByTestId('room').textContent).toBe('Block X - 101');

        rerender(<MiniTimetableCard entry={entryTwo} />);
        expect(screen.getByTestId('batch').textContent).toBe('GRP-2');
        expect(screen.getByTestId('teacher').textContent).toBe('Faculty Beta');
        expect(screen.getByTestId('room').textContent).toBe('Block Y - 202');
    });

    it('does not crash for an unknown or future batch code', () => {
        const futureBatch = makeBatch('FUTURE-BATCH-99');
        const entry = makeEntry({ batchId: futureBatch as unknown as string });
        // Should render without throwing
        expect(() => render(<MiniTimetableCard entry={entry} />)).not.toThrow();
        expect(screen.getByTestId('batch').textContent).toBe('FUTURE-BATCH-99');
    });
});

// ---------------------------------------------------------------------------
// PART B — Client-side batch filter logic
// (Mirrors the filteredEntries useMemo in TimetablePage)
// ---------------------------------------------------------------------------

function applyBatchFilter(entries: ITimetableEntry[], selectedBatchId: string): ITimetableEntry[] {
    if (!selectedBatchId) return entries;
    return entries.filter((e) => {
        const bid =
            typeof e.batchId === 'string'
                ? e.batchId
                : (e.batchId as unknown as { _id?: string })?._id ?? null;
        return bid === selectedBatchId || bid == null;
    });
}

describe('Batch filter logic', () => {
    const batchAlpha = makeBatch('GRP-ALPHA');
    const batchBeta = makeBatch('GRP-BETA');

    const entryAlpha = makeEntry({ _id: 'eA', batchId: batchAlpha as unknown as string });
    const entryBeta = makeEntry({ _id: 'eB', batchId: batchBeta as unknown as string });
    const entryAll = makeEntry({ _id: 'eALL', batchId: null }); // whole-class

    const allEntries = [entryAlpha, entryBeta, entryAll];

    it('no filter (empty string) returns all entries', () => {
        const result = applyBatchFilter(allEntries, '');
        expect(result).toHaveLength(3);
    });

    it('selecting GRP-ALPHA returns GRP-ALPHA entry + ALL entry', () => {
        const result = applyBatchFilter(allEntries, batchAlpha._id);
        expect(result.map((e) => e._id).sort()).toEqual(['eA', 'eALL'].sort());
    });

    it('selecting GRP-BETA returns GRP-BETA entry + ALL entry', () => {
        const result = applyBatchFilter(allEntries, batchBeta._id);
        expect(result.map((e) => e._id).sort()).toEqual(['eB', 'eALL'].sort());
    });

    it('whole-class entry is included for every specific batch selection', () => {
        const result = applyBatchFilter(allEntries, batchAlpha._id);
        expect(result.find((e) => e._id === 'eALL')).toBeDefined();
    });

    it('a specific batch entry is NOT visible when filtering on a different batch', () => {
        const result = applyBatchFilter(allEntries, batchAlpha._id);
        expect(result.find((e) => e._id === 'eB')).toBeUndefined();
    });

    it('legacy entry (batchId undefined) is treated as whole-class and shown for any filter', () => {
        const legacyEntry = makeEntry({ _id: 'eLegacy' });
        delete (legacyEntry as unknown as Record<string, unknown>)['batchId'];
        const result = applyBatchFilter([legacyEntry, entryAlpha], batchAlpha._id);
        expect(result.find((e) => e._id === 'eLegacy')).toBeDefined();
    });
});
