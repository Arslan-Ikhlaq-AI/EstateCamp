import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/components/ui/empty';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from '@/components/ui/input-group';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatMediumDateTime, formatNumber, getInitials } from '@/lib/format';
import {
    ArrowDownIcon,
    ArrowUpIcon,
    CheckIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronsUpDownIcon,
    SearchIcon,
    SearchXIcon,
    XIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';

const statusItems = [
    { label: 'All statuses', value: 'all' },
    { label: 'Verified', value: 'verified' },
    { label: 'Unverified', value: 'unverified' },
];

const SEARCH_DEBOUNCE_MS = 300;

function SortableHead({ column, filters, onSort, className, children }) {
    const isSorted = filters.sort === column;
    const isAscending = filters.direction === 'asc';

    const Icon = !isSorted
        ? ChevronsUpDownIcon
        : isAscending
          ? ArrowUpIcon
          : ArrowDownIcon;

    return (
        <TableHead
            className={className}
            aria-sort={
                isSorted ? (isAscending ? 'ascending' : 'descending') : 'none'
            }
        >
            <Button
                variant="ghost"
                size="sm"
                className="-ml-2.5"
                onClick={() => onSort(column)}
            >
                {children}
                <Icon data-icon="inline-end" />
            </Button>
        </TableHead>
    );
}

export default function UsersTable({
    users,
    filters,
    isLoading,
    onFilterChange,
    onPageChange,
}) {
    const [search, setSearch] = useState(filters.search);

    useEffect(() => {
        if (search === filters.search) {
            return;
        }

        const timeout = setTimeout(
            () => onFilterChange({ search }),
            SEARCH_DEBOUNCE_MS,
        );

        return () => clearTimeout(timeout);
    }, [search, filters.search, onFilterChange]);

    const hasActiveFilters = filters.search !== '' || filters.status !== null;

    const clearFilters = () => {
        setSearch('');
        onFilterChange({ search: '', status: null });
    };

    const sortBy = (column) => {
        const isSameColumn = filters.sort === column;
        const defaultDirection = column === 'created_at' ? 'desc' : 'asc';

        onFilterChange({
            sort: column,
            direction: isSameColumn
                ? filters.direction === 'asc'
                    ? 'desc'
                    : 'asc'
                : defaultDirection,
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Users</CardTitle>
                <CardDescription>
                    {formatNumber(users.total)}{' '}
                    {users.total === 1 ? 'user' : 'users'}
                    {hasActiveFilters ? ' match the current filters' : ' registered'}
                </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
                <div
                    role="search"
                    className="flex flex-col gap-2 sm:flex-row sm:items-center"
                >
                    <InputGroup className="sm:max-w-xs">
                        <InputGroupInput
                            type="search"
                            name="search"
                            placeholder="Search by name or email"
                            aria-label="Search users by name or email"
                            autoComplete="off"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <InputGroupAddon>
                            <SearchIcon />
                        </InputGroupAddon>
                    </InputGroup>

                    <Select
                        items={statusItems}
                        value={filters.status ?? 'all'}
                        onValueChange={(value) =>
                            onFilterChange({
                                status: value === 'all' ? null : value,
                            })
                        }
                    >
                        <SelectTrigger
                            className="w-full sm:w-44"
                            aria-label="Filter by verification status"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                {statusItems.map((item) => (
                                    <SelectItem
                                        key={item.value}
                                        value={item.value}
                                    >
                                        {item.label}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>

                    {hasActiveFilters && (
                        <Button variant="ghost" onClick={clearFilters}>
                            <XIcon data-icon="inline-start" />
                            Clear filters
                        </Button>
                    )}
                </div>

                <div
                    aria-busy={isLoading}
                    className="rounded-lg border transition-opacity data-[loading=true]:opacity-60"
                    data-loading={isLoading}
                >
                    <Table>
                        <TableCaption className="sr-only">
                            Registered users, sortable by name, email and join
                            date
                        </TableCaption>
                        <TableHeader>
                            <TableRow>
                                <SortableHead
                                    column="name"
                                    filters={filters}
                                    onSort={sortBy}
                                >
                                    User
                                </SortableHead>
                                <SortableHead
                                    column="email"
                                    filters={filters}
                                    onSort={sortBy}
                                    className="hidden md:table-cell"
                                >
                                    Email
                                </SortableHead>
                                <TableHead>Status</TableHead>
                                <SortableHead
                                    column="created_at"
                                    filters={filters}
                                    onSort={sortBy}
                                    className="hidden sm:table-cell"
                                >
                                    Joined
                                </SortableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.data.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={4}
                                        className="whitespace-normal"
                                    >
                                        <Empty>
                                            <EmptyHeader>
                                                <EmptyMedia variant="icon">
                                                    <SearchXIcon />
                                                </EmptyMedia>
                                                <EmptyTitle>
                                                    No users found
                                                </EmptyTitle>
                                                <EmptyDescription>
                                                    Try a different search term
                                                    or clear the filters.
                                                </EmptyDescription>
                                            </EmptyHeader>
                                            {hasActiveFilters && (
                                                <EmptyContent>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={clearFilters}
                                                    >
                                                        Clear filters
                                                    </Button>
                                                </EmptyContent>
                                            )}
                                        </Empty>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users.data.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar>
                                                    <AvatarFallback>
                                                        {getInitials(user.name)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex min-w-0 flex-col">
                                                    <span className="flex items-center gap-2 font-medium">
                                                        {user.name}
                                                        {user.isAdmin && (
                                                            <Badge variant="outline">
                                                                Admin
                                                            </Badge>
                                                        )}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground md:hidden">
                                                        {user.email}
                                                    </span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden text-muted-foreground md:table-cell">
                                            {user.email}
                                        </TableCell>
                                        <TableCell>
                                            {user.emailVerifiedAt ? (
                                                <Badge variant="secondary">
                                                    <CheckIcon data-icon="inline-start" />
                                                    Verified
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline">
                                                    Unverified
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="hidden text-muted-foreground sm:table-cell">
                                            <time dateTime={user.createdAt}>
                                                {formatMediumDateTime(
                                                    user.createdAt,
                                                )}
                                            </time>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                    <p
                        className="text-sm text-muted-foreground"
                        aria-live="polite"
                    >
                        {users.total === 0
                            ? 'No results'
                            : `Showing ${formatNumber(users.from)}–${formatNumber(users.to)} of ${formatNumber(users.total)}`}
                    </p>

                    <nav
                        aria-label="Users pagination"
                        className="flex items-center gap-2"
                    >
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={users.current_page <= 1}
                            onClick={() => onPageChange(users.current_page - 1)}
                        >
                            <ChevronLeftIcon data-icon="inline-start" />
                            Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                            Page {users.current_page} of {users.last_page}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={users.current_page >= users.last_page}
                            onClick={() => onPageChange(users.current_page + 1)}
                        >
                            Next
                            <ChevronRightIcon data-icon="inline-end" />
                        </Button>
                    </nav>
                </div>
            </CardContent>
        </Card>
    );
}
