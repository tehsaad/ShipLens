import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

/**
 * Renders content Markdown (section 8, XSS): raw HTML is never rendered, and the output goes
 * through rehype-sanitize's allow-list (GitHub's schema) before it reaches React.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-content grid gap-4 leading-relaxed">
      <ReactMarkdown
        skipHtml
        rehypePlugins={[rehypeSanitize]}
        components={{
          h1: (props) => <h2 className="text-2xl font-semibold" {...props} />,
          h2: (props) => <h3 className="text-xl font-semibold" {...props} />,
          h3: (props) => <h4 className="text-lg font-semibold" {...props} />,
          a: (props) => (
            <a className="text-primary underline" rel="noopener noreferrer" {...props} />
          ),
          ul: (props) => <ul className="list-disc space-y-1 ps-6" {...props} />,
          ol: (props) => <ol className="list-decimal space-y-1 ps-6" {...props} />,
          blockquote: (props) => <blockquote className="border-s-4 ps-4 italic" {...props} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
