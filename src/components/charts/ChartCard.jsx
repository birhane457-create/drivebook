import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default function ChartCard({ title, description, icon: Icon, action, children, className, contentClassName }) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
            {title}
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}