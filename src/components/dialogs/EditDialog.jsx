import FormDialog from './FormDialog';

export default function EditDialog({ submitLabel = 'Save changes', description = 'Update the record details below.', title = 'Edit', ...props }) {
  return <FormDialog title={title} description={description} submitLabel={submitLabel} {...props} />;
}