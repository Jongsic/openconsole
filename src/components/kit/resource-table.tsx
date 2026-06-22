import type { ComponentType, ReactNode } from "react";
import { ResourceError } from "../resource-error";
import { EmptyState } from "./empty-state";
import { Table, TableLoading, Thead } from "./table";

/**
 * A list-view table that owns the loading / error / empty branches every page
 * currently hand-rolls. Pass query state plus the data; render `head` (a single
 * `<tr>` of `<Th>`s) and `row(item)` (the `<tr>` for one item).
 *
 * `getKey` provides a stable React key per row. `service` is forwarded to
 * <ResourceError> (already a plain string label, not an i18n key). `empty`
 * supplies the empty-state icon/message/action.
 */
export function ResourceTable<T>({
  isLoading,
  isError,
  error,
  service,
  data,
  getKey,
  head,
  row,
  empty,
}: {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  service: string;
  data: T[] | undefined;
  getKey: (item: T) => string;
  head: ReactNode;
  row: (item: T) => ReactNode;
  empty: { icon: ComponentType<{ className?: string }>; message: ReactNode; action?: ReactNode };
}) {
  if (isLoading) return <TableLoading />;
  if (isError) return <ResourceError error={error} service={service} />;
  if (!data || data.length === 0)
    return <EmptyState icon={empty.icon} message={empty.message} action={empty.action} />;

  return (
    <Table>
      <Thead>{head}</Thead>
      <tbody>
        {data.map((item) => (
          <KeyedRow key={getKey(item)}>{row(item)}</KeyedRow>
        ))}
      </tbody>
    </Table>
  );
}

/** Wrapper so the row callback can return the bare <tr> without owning the key. */
function KeyedRow({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
