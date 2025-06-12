import React from 'react';
import { Avatar } from '@mantine/core';

export interface UserAvatarProps {
  name?: string;
  email?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ 
  name, 
  email, 
  size = 'sm',
  color = 'blue'
}) => {
  const getInitials = () => {
    if (name) {
      return name
        .split(' ')
        .map(word => word.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email.charAt(0).toUpperCase();
    }
    return '?';
  };

  return (
    <Avatar size={size} color={color}>
      {getInitials()}
    </Avatar>
  );
};