import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { useTranslation } from '@/hooks/use-translation';
import { getInitials } from '@/lib/format';

export default function TeamCard({ team, className }) {
    const { t } = useTranslation();

    return (
        <Card className={className}>
            <CardHeader className="border-b">
                <CardTitle>{t('dashboard.team.title')}</CardTitle>
                <CardDescription>{t('dashboard.team.description')}</CardDescription>
                <CardAction>
                    <Badge variant="secondary">{t('common.members', { count: team.length })}</Badge>
                </CardAction>
            </CardHeader>
            <CardContent>
                <ul className="-mx-2 flex flex-col gap-0.5">
                    {team.map((member) => (
                        <li key={member.id} className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/70">
                            <Avatar>
                                <AvatarFallback className="bg-primary/[0.08] text-xs font-semibold text-primary">
                                    {getInitials(member.name)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-sm font-medium">{member.name}</span>
                                <span className="truncate text-xs text-muted-foreground">{member.email}</span>
                            </div>
                            {member.role && (
                                <Badge variant="secondary" className="shrink-0">
                                    {member.role}
                                </Badge>
                            )}
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
}
