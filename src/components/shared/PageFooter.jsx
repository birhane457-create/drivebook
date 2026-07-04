/**
 * PageFooter — minimal standard footer shown on every authenticated page.
 * One line: app name · version · © year.
 */
export default function PageFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border mt-8 px-4 py-3 text-center text-xs text-muted-foreground">
      WMS Pro · v1.0 · © {year}
    </footer>
  );
}