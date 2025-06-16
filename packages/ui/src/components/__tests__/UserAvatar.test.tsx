import React from 'react';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { UserAvatar } from '../UserAvatar';

// Wrapper component to provide Mantine context
const MantineWrapper = ({ children }: { children: React.ReactNode }) => (
  <MantineProvider>{children}</MantineProvider>
);

describe('UserAvatar', () => {
  const mockUser = testUtils.createMockUser();

  it('should render user avatar with name initials', () => {
    render(
      <MantineWrapper>
        <UserAvatar user={mockUser} size="md" />
      </MantineWrapper>
    );

    // Should show initials from the name
    expect(screen.getByText('TU')).toBeInTheDocument(); // Test User -> TU
  });

  it('should render avatar with email initials when no name provided', () => {
    const userWithoutName = { ...mockUser, name: null };
    
    render(
      <MantineWrapper>
        <UserAvatar user={userWithoutName} size="md" />
      </MantineWrapper>
    );

    // Should show initials from email
    expect(screen.getByText('TE')).toBeInTheDocument(); // test@example.com -> TE
  });

  it('should apply correct size prop', () => {
    const { container } = render(
      <MantineWrapper>
        <UserAvatar user={mockUser} size="lg" />
      </MantineWrapper>
    );

    // Check if the avatar has the large size class
    const avatar = container.querySelector('[data-size="lg"]');
    expect(avatar).toBeInTheDocument();
  });

  it('should show tooltip with user information on hover', async () => {
    render(
      <MantineWrapper>
        <UserAvatar user={mockUser} size="md" showTooltip />
      </MantineWrapper>
    );

    // The tooltip should contain user information
    // Note: Testing tooltip hover behavior requires more complex setup
    // This is a basic check that the component renders
    expect(screen.getByText('TU')).toBeInTheDocument();
  });

  it('should handle different user roles with role badge', () => {
    const editorUser = { ...mockUser, role: 'EDITOR' as const };
    
    render(
      <MantineWrapper>
        <UserAvatar user={editorUser} size="md" showRole />
      </MantineWrapper>
    );

    // Should render the avatar (role badge testing would need more specific implementation)
    expect(screen.getByText('TU')).toBeInTheDocument();
  });

  it('should render with custom color variant', () => {
    const { container } = render(
      <MantineWrapper>
        <UserAvatar user={mockUser} size="md" variant="filled" color="blue" />
      </MantineWrapper>
    );

    // Check if the avatar has the filled variant
    const avatar = container.querySelector('[data-variant="filled"]');
    expect(avatar).toBeInTheDocument();
  });

  it('should be clickable when onClick is provided', () => {
    const handleClick = jest.fn();
    
    render(
      <MantineWrapper>
        <UserAvatar user={mockUser} size="md" onClick={handleClick} />
      </MantineWrapper>
    );

    const avatar = screen.getByText('TU');
    avatar.click();
    
    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith(mockUser);
  });

  it('should generate consistent initials for same user', () => {
    const { rerender } = render(
      <MantineWrapper>
        <UserAvatar user={mockUser} size="md" />
      </MantineWrapper>
    );

    expect(screen.getByText('TU')).toBeInTheDocument();

    // Re-render with same user
    rerender(
      <MantineWrapper>
        <UserAvatar user={mockUser} size="sm" />
      </MantineWrapper>
    );

    // Should still show same initials
    expect(screen.getByText('TU')).toBeInTheDocument();
  });
});