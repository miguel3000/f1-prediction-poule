// Renders a translated string where **double asterisks** mark bold text, so a
// sentence with an emphasised phrase stays one translatable unit.
const Rich = ({ text }: { text: string }) => (
  <>
    {text.split('**').map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))}
  </>
);

export default Rich;
