
import React from 'react';
import { cn } from '../../lib/utils';

interface ListProps extends React.HTMLAttributes<HTMLUListElement> {
  children: React.ReactNode;
}

interface ListItemProps extends React.HTMLAttributes<HTMLLIElement> {
  children: React.ReactNode;
}

const List = React.forwardRef<HTMLUListElement, ListProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <ul
        ref={ref}
        className={cn("space-y-1", className)}
        {...props}
      >
        {children}
      </ul>
    );
  }
);

const ListItem = React.forwardRef<HTMLLIElement, ListItemProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <li
        ref={ref}
        className={cn("flex items-center text-sm", className)}
        {...props}
      >
        {children}
      </li>
    );
  }
);

List.displayName = "List";
ListItem.displayName = "ListItem";

export { List, ListItem };
