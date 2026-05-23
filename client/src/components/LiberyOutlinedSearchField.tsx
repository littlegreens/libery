import MaterialSearchField, { type MaterialSearchFieldProps } from '@/components/MaterialSearchField';

export type LiberyOutlinedSearchFieldProps = MaterialSearchFieldProps;

/**
 * Campo ricerca Material (`md-search` del fork), stesso comportamento delle pagine punti/ricerca/mappa.
 */
export default function LiberyOutlinedSearchField(props: LiberyOutlinedSearchFieldProps) {
  return <MaterialSearchField {...props} />;
}
