import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Modal } from './components/ui/Modal.js';
import { DataTable } from './components/ui/DataTable.js';
import { Badge } from './components/ui/Badge.js';
import { Button } from './components/ui/Button.js';
import { apiClient } from './api/client.js';
import { ToastProvider } from './contexts/ToastContext.js';
import { ImportPage } from './pages/ImportPage.js';

describe('Web UI Components & Pages Suite', () => {
  it('renders DataTable with columns and data rows cleanly', () => {
    interface SampleData {
      id: string;
      code: string;
      name: string;
      status: string;
    }

    const columns = [
      { key: 'code', header: 'Code' },
      { key: 'name', header: 'Name' },
      {
        key: 'status',
        header: 'Status',
        render: (item: SampleData) => <Badge variant="emerald">{item.status}</Badge>,
      },
    ];

    const data: SampleData[] = [
      { id: '1', code: 'CS101', name: 'Data Structures', status: 'Active' },
      { id: '2', code: 'CS102', name: 'Algorithms', status: 'Active' },
    ];

    render(
      <DataTable
        columns={columns}
        data={data}
        isLoading={false}
        meta={{
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        }}
      />
    );

    expect(screen.getByText('CS101')).toBeDefined();
    expect(screen.getByText('Data Structures')).toBeDefined();
    expect(screen.getByText('Algorithms')).toBeDefined();
  });

  it('renders modal dialog when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Edit Classroom">
        <div data-testid="modal-body">Room 302 Details</div>
      </Modal>
    );

    expect(screen.getByText('Edit Classroom')).toBeDefined();
    expect(screen.getByTestId('modal-body')).toBeDefined();
  });

  it('does not render modal content when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={() => {}} title="Hidden Dialog">
        <div>Should Not Be Visible</div>
      </Modal>
    );

    expect(screen.queryByText('Hidden Dialog')).toBeNull();
  });

  it('renders various badge variants correctly', () => {
    const { rerender } = render(<Badge variant="rose">High Priority</Badge>);
    expect(screen.getByText('High Priority')).toBeDefined();

    rerender(<Badge variant="amber">Pending</Badge>);
    expect(screen.getByText('Pending')).toBeDefined();

    rerender(<Badge variant="blue">Info</Badge>);
    expect(screen.getByText('Info')).toBeDefined();
  });

  it('renders buttons with loading spinners and disabled states', () => {
    render(
      <Button variant="primary" isLoading={true} disabled={true}>
        Generate Timetable
      </Button>
    );

    const button = screen.getByRole('button');
    expect(button).toBeDefined();
    expect(button.getAttribute('disabled')).toBeDefined();
  });

  it('loads and displays row-level import diagnostics only when a history item expands', async () => {
    const jobId = 'job-1';
    const get = vi.spyOn(apiClient, 'get').mockImplementation((async (url: string) => {
      if (url.startsWith('/departments')) {
        return { data: { success: true, data: [] } };
      }
      if (url.startsWith('/import/jobs?')) {
        return {
          data: {
            success: true,
            data: [{
              _id: jobId,
              type: 'MASTER',
              fileName: 'import-errors.xlsx',
              status: 'PARTIAL',
              progress: 100,
              totalRows: 3,
              processedRows: 2,
              successRows: 1,
              errorRows: 1,
              skippedRows: 1,
              totalSheets: 2,
              warnings: [],
              worksheetResults: [],
              rowErrors: [],
              createdBy: 'user-1',
              createdAt: '2026-10-01T00:00:00.000Z',
              updatedAt: '2026-10-01T00:00:00.000Z',
            }],
            meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
          },
        };
      }
      if (url === `/import/jobs/${jobId}`) {
        return {
          data: {
            success: true,
            data: {
              _id: jobId,
              type: 'MASTER',
              fileName: 'import-errors.xlsx',
              status: 'PARTIAL',
              progress: 100,
              totalRows: 3,
              processedRows: 2,
              successRows: 1,
              errorRows: 1,
              skippedRows: 1,
              totalSheets: 2,
              warnings: ['Worksheet Notes was skipped'],
              worksheetResults: [{
                sheetName: 'Teachers', entityType: 'TEACHERS', foundRows: 2,
                processedRows: 2, importedRows: 1, skippedRows: 0, failedRows: 1, warnings: [],
              }],
              rowErrors: [{
                row: 4, field: 'email', message: 'Valid email is required',
                sheetName: 'Teachers', entityType: 'TEACHERS',
              }],
              createdBy: 'user-1',
              startedAt: '2026-10-01T00:00:00.000Z',
              completedAt: '2026-10-01T00:01:00.000Z',
              createdAt: '2026-10-01T00:00:00.000Z',
              updatedAt: '2026-10-01T00:01:00.000Z',
            },
          },
        };
      }
      throw new Error(`Unexpected GET ${url}`);
    }) as never);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter><ImportPage /></MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Import History' }));
    expect(await screen.findByText('import-errors.xlsx')).toBeDefined();
    expect(get).not.toHaveBeenCalledWith(`/import/jobs/${jobId}`);

    fireEvent.click(screen.getByRole('button', { name: 'View details' }));
    expect(await screen.findByText('Valid email is required')).toBeDefined();
    expect(screen.getByText('Teachers')).toBeDefined();
    expect(screen.getByText('Worksheet Notes was skipped')).toBeDefined();
    expect(get).toHaveBeenCalledWith(`/import/jobs/${jobId}`);

    queryClient.clear();
    vi.restoreAllMocks();
  });
});
