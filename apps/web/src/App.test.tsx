import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Button } from './components/ui/Button.js';
import { Badge } from './components/ui/Badge.js';
import { Card } from './components/ui/Card.js';

describe('UI Component Library', () => {
  it('renders primary button with children and clicks', () => {
    let clicked = false;
    render(
      <Button variant="primary" onClick={() => (clicked = true)}>
        Click Me
      </Button>
    );

    const btn = screen.getByRole('button', { name: /click me/i });
    expect(btn).toBeDefined();
    btn.click();
    expect(clicked).toBe(true);
  });

  it('renders badge with variant', () => {
    render(<Badge variant="teal">Active Badge</Badge>);
    expect(screen.getByText(/active badge/i)).toBeDefined();
  });

  it('renders card container with children', () => {
    render(
      <Card>
        <span data-testid="card-child">Card Content</span>
      </Card>
    );
    expect(screen.getByTestId('card-child')).toBeDefined();
  });
});
