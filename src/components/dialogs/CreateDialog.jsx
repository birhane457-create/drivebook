import FormDialog from './FormDialog';

export default function CreateDialog({ submitLabel = 'Create', description = 'Fill in the details to create a new record.', title = 'Create', ...props }) {
  return <FormDialog title={title} description={description} submitLabel={submitLabel} {...props} />;
}