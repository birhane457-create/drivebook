import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getAccessibleRoutes, canAccess } from '@/lib/route-access';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem,
} from '@/components/ui/command';
import { Package, FileText, Store } from 'lucide-react';

export default function CommandPalette({ open, onOpenChange }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  const role = user?.role || 'cashier';
  const routes = useMemo(() => getAccessibleRoutes(role), [role]);

  const enabled = open;
  const { data: products = [] } = useQuery({ queryKey: ['cmd-products'], queryFn: () => base44.entities.Product.list('-updated_date', 200), enabled, staleTime: 60000 });
  const { data: pos = [] } = useQuery({ queryKey: ['cmd-pos'], queryFn: () => base44.entities.PurchaseOrder.list('-updated_date', 100), enabled, staleTime: 60000 });
  const { data: suppliers = [] } = useQuery({ queryKey: ['cmd-suppliers'], queryFn: () => base44.entities.Supplier.list('-updated_date', 100), enabled, staleTime: 60000 });

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const q = search.trim().toLowerCase();
  const hasQuery = q.length >= 1;

  const productMatches = hasQuery && canAccess('/products', role)
    ? products.filter(p => (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)).slice(0, 6) : [];
  const poMatches = hasQuery && canAccess('/purchases', role)
    ? pos.filter(p => (p.po_number || '').toLowerCase().includes(q)).slice(0, 6) : [];
  const supplierMatches = hasQuery && canAccess('/suppliers', role)
    ? suppliers.filter(s => (s.name || '').toLowerCase().includes(q)).slice(0, 6) : [];

  const go = (path) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search pages, products, POs, suppliers…"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {!hasQuery && (
          <CommandGroup heading="Pages">
            {routes.map((route) => (
              <CommandItem
                key={route.path}
                value={`${route.label} ${route.keywords.join(' ')}`}
                onSelect={() => go(route.path)}
                className="cursor-pointer"
              >
                <span className="font-medium">{route.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">{route.path}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {productMatches.length > 0 && (
          <CommandGroup heading="Products">
            {productMatches.map(p => (
              <CommandItem
                key={p.id}
                value={`product ${p.name} ${p.sku}`}
                onSelect={() => go('/products')}
                className="cursor-pointer"
              >
                <Package className="w-4 h-4 mr-2 text-muted-foreground" />
                <span className="font-medium truncate">{p.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{p.sku}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {poMatches.length > 0 && (
          <CommandGroup heading="Purchase Orders">
            {poMatches.map(p => (
              <CommandItem
                key={p.id}
                value={`po ${p.po_number}`}
                onSelect={() => go('/purchases')}
                className="cursor-pointer"
              >
                <FileText className="w-4 h-4 mr-2 text-muted-foreground" />
                <span className="font-medium">{p.po_number}</span>
                <span className="ml-auto text-xs text-muted-foreground capitalize">{p.status}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {supplierMatches.length > 0 && (
          <CommandGroup heading="Suppliers">
            {supplierMatches.map(s => (
              <CommandItem
                key={s.id}
                value={`supplier ${s.name}`}
                onSelect={() => go('/suppliers')}
                className="cursor-pointer"
              >
                <Store className="w-4 h-4 mr-2 text-muted-foreground" />
                <span className="font-medium truncate">{s.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}