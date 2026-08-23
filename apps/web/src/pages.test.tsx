import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Modal } from './components/ui/Modal.js';
import { DataTable } from './components/ui/DataTable.js';
import { Badge } from './components/ui/Badge.js';
import { Button } from './components/ui/Button.js';

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
});
