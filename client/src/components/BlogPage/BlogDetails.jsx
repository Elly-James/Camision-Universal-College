import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getBlog, getBlogs } from '../../utils/api.js';
import toast from 'react-hot-toast';
import Header from '../Header/Header.jsx';
import './BlogDetails.css';

const BlogDetails = () => {
  const { id } = useParams();
  const [blog, setBlog] = useState(null);
  const [relatedBlogs, setRelatedBlogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBlog = async () => {
      setLoading(true);
      try {
        const response = await getBlog(id);
        setBlog(response);
        const blogsResponse = await getBlogs(1, 4);
        setRelatedBlogs(blogsResponse.blogs.filter((b) => b.id !== parseInt(id)));
      } catch (error) {
        toast.error(error.message || 'Failed to load blog');
      } finally {
        setLoading(false);
      }
    };
    fetchBlog();
  }, [id]);

  if (loading) {
    return (
      <>
        <Header />
        <div className="blog-details-container">
          <div className="blog-details">
            <div className="loading-spinner">Loading blog details...</div>
          </div>
        </div>
      </>
    );
  }

  if (!blog) {
    return (
      <>
        <Header />
        <div className="blog-details-container">
          <div className="blog-details">
            <div className="not-found">Blog not found.</div>
          </div>
        </div>
      </>
    );
  }

  const renderContent = (content) => {
    if (!content) return null;

    const sections = content.split('\n').filter(line => line.trim());
    const elements = [];
    let currentList = [];
    let tocItems = [];
    let sectionIndex = 0;

    for (let i = 0; i < sections.length; i++) {
      const line = sections[i].trim();
      if (!line) continue;

      // Handle main headings (##)
      if (line.startsWith('## ')) {
        // Close any open list
        if (currentList.length > 0) {
          elements.push(
            <ul key={`list-${i}`} className="content-list">
              {currentList}
            </ul>
          );
          currentList = [];
        }

        const headingText = line.replace('## ', '');
        const headingId = `section-${sectionIndex}`;
        
        // Add to table of contents
        tocItems.push({
          id: headingId,
          text: headingText,
          index: sectionIndex
        });

        elements.push(
          <h2 key={i} id={headingId} className="section-heading">
            {headingText}
          </h2>
        );
        sectionIndex++;
        continue;
      }

      // Handle secondary headings (single words or phrases ending with colon)
      if (line.endsWith(':') && !line.startsWith('*') && line.split(' ').length <= 4) {
        // Close any open list
        if (currentList.length > 0) {
          elements.push(
            <ul key={`list-${i}`} className="content-list">
              {currentList}
            </ul>
          );
          currentList = [];
        }

        elements.push(
          <h3 key={i} className="subsection-heading">
            {line.replace(':', '')}
          </h3>
        );
        continue;
      }

      // Handle list items
      if (line.startsWith('* ')) {
        const listContent = line.replace('* ', '');
        currentList.push(
          <li key={`list-item-${i}`} className="list-item">
            {formatInlineText(listContent)}
          </li>
        );
        continue;
      }

      // Close any open list before adding paragraph
      if (currentList.length > 0) {
        elements.push(
          <ul key={`list-${i}`} className="content-list">
            {currentList}
          </ul>
        );
        currentList = [];
      }

      // Handle regular paragraphs
      if (line.length > 0) {
        elements.push(
          <p key={i} className="content-paragraph">
            {formatInlineText(line)}
          </p>
        );
      }
    }

    // Close any remaining list
    if (currentList.length > 0) {
      elements.push(
        <ul key="final-list" className="content-list">
          {currentList}
        </ul>
      );
    }

    return { elements, tocItems };
  };

  const formatInlineText = (text) => {
    let formatted = text;
    
    // Handle bold text (**text**)
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="bold-text">$1</strong>');
    
    // Handle italic text (*text*)
    formatted = formatted.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em class="italic-text">$1</em>');
    
    // Handle links [text](url)
    formatted = formatted.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g, 
      '<a href="$2" class="content-link" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    
    return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
  };

  const { elements, tocItems } = renderContent(blog.content);

  return (
    <>
      <Header />
      <div className="blog-details-container">
        <div className="blog-details">
          <article className="blog-article">
            <header className="blog-header">
              <h1 className="blog-title">{blog.title}</h1>
              <div className="blog-meta-info">
                <span className="blog-author">By {blog.author_name}</span>
                <span className="blog-date">{new Date(blog.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</span>
              </div>
            </header>

            {tocItems.length > 0 && (
              <nav className="table-of-contents">
                <h2 className="toc-title">Table of Contents</h2>
                <ol className="toc-list">
                  {tocItems.map((item) => (
                    <li key={item.index} className="toc-item">
                      <a href={`#${item.id}`} className="toc-link">
                        {item.text}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}

            <div className="blog-content">
              {elements}
            </div>

            <footer className="blog-footer">
              {blog.url && (
                <div className="blog-source">
                  <span className="source-label">Source:</span>
                  <a
                    href={blog.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="source-link"
                  >
                    {blog.url}
                  </a>
                </div>
              )}
              
              {blog.email && (
                <div className="blog-contact">
                  <span className="contact-label">Contact:</span>
                  <a href={`mailto:${blog.email}`} className="contact-link">
                    {blog.email}
                  </a>
                </div>
              )}
            </footer>
          </article>

          {relatedBlogs.length > 0 && (
            <section className="related-posts">
              <h2 className="related-posts-title">Related Articles</h2>
              <div className="related-posts-grid">
                {relatedBlogs.slice(0, 3).map((relatedBlog) => (
                  <Link
                    to={`/blog/${relatedBlog.id}`}
                    key={relatedBlog.id}
                    className="related-post-card"
                  >
                    <div className="related-card-image">
                      {relatedBlog.image ? (
                        <img
                          src={relatedBlog.image}
                          alt={relatedBlog.title}
                          className="related-post-image"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className="related-post-placeholder" style={{display: relatedBlog.image ? 'none' : 'flex'}}>
                        <span className="placeholder-icon">📄</span>
                        <span className="placeholder-text">Article</span>
                      </div>
                    </div>
                    <div className="related-card-content">
                      <h3 className="related-post-title">{relatedBlog.title}</h3>
                      <p className="related-post-author">By {relatedBlog.author_name}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
};

export default BlogDetails;