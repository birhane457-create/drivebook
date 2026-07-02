import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getAccessibleRoutes } from '@/lib/route-access';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem,
} from '@/components/ui/command';

export default function CommandPalette({ open, onOpenChange }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  const role = user?.role || 'cashier';
  const routes = useMemo(() => getAccessibleRoutes(role), [role]);

  // Reset search when palette closes
  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const handleSelect = (path) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search pages... (type to filter)"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No pages found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {routes.map((route) => (
            <CommandItem
              key={route.path}
              value={`${route.label} ${route.keywords.join(' ')}`}
              onSelect={() => handleSelect(route.path)}
              className="cursor-pointer"
            >
              <span className="font-medium">{route.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">{route.path}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}