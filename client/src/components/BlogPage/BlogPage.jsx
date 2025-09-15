import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getBlogs } from '../../utils/api.js';
import toast from 'react-hot-toast';
import Header from '../Header/Header.jsx';
import './BlogPage.css';

const BlogPage = () => {
  const [blogs, setBlogs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchBlogs = async (page) => {
    setLoading(true);
    try {
      const response = await getBlogs(page, 6);
      setBlogs(response.blogs);
      setTotalPages(response.pages);
    } catch (error) {
      toast.error(error.message || 'Failed to load blogs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlogs(currentPage);
  }, [currentPage]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const stripMarkdown = (text) => {
    if (!text) return '';
    
    // Remove markdown symbols and clean text
    let cleaned = text
      .replace(/##\s+/g, '') // Remove ## headings
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1') // Remove italic
      .replace(/\*\s+/g, '') // Remove list markers
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1') // Remove links, keep text
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    // Create a meaningful excerpt
    return cleaned.length > 150 ? cleaned.substring(0, 147) + '...' : cleaned;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const calculateReadTime = (content) => {
    if (!content) return '5 min read';
    const wordsPerMinute = 200;
    const wordCount = content.split(/\s+/).length;
    const readTime = Math.ceil(wordCount / wordsPerMinute);
    return `${readTime} min read`;
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="blog-page-container">
          <div className="blog-page">
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p className="loading-text">Loading amazing articles...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="blog-page-container">
        <div className="blog-page">
          <header className="blog-header">
            <h1 className="blog-page-title">Knowledge Hub</h1>
            <p className="blog-description">
              Discover expert insights, academic guides, and professional resources designed to elevate your learning journey
            </p>
          </header>

          <main className="blog-main">
            {blogs.length > 0 ? (
              <div className="blog-grid">
                {blogs.map((blog, index) => {
                  const excerpt = stripMarkdown(blog.content);
                  const readTime = calculateReadTime(blog.content);
                  const isRecent = new Date(blog.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                  
                  return (
                    <article key={blog.id} className={`blog-card ${index === 0 && currentPage === 1 ? 'featured-card' : ''}`}>
                      {isRecent && <div className="new-badge">New</div>}
                      
                      <Link to={`/blog/${blog.id}`} className="blog-card-link">
                        <div className="blog-card-image-container">
                          {blog.image ? (
                            <img
                              src={blog.image}
                              alt={blog.title}
                              className="blog-card-image"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div className="blog-card-placeholder" style={{display: blog.image ? 'none' : 'flex'}}>
                            <span className="placeholder-icon">📚</span>
                            <span className="placeholder-text">Article</span>
                          </div>
                        </div>

                        <div className="blog-card-content">
                          <div className="blog-card-tags">
                            <span className="read-time-tag">{readTime}</span>
                            {blog.subject && <span className="subject-tag">{blog.subject}</span>}
                          </div>
                          
                          <h2 className="blog-card-title">{blog.title}</h2>
                          
                          {excerpt && (
                            <p className="blog-card-excerpt">{excerpt}</p>
                          )}
                          
                          <div className="blog-card-footer">
                            <div className="author-info">
                              <div className="author-avatar">
                                {blog.author_name.charAt(0).toUpperCase()}
                              </div>
                              <div className="author-details">
                                <span className="author-name">{blog.author_name}</span>
                                <span className="publish-date">{formatDate(blog.created_at)}</span>
                              </div>
                            </div>
                            <div className="read-more">
                              <span className="read-more-text">Read Article</span>
                              <span className="read-more-arrow">→</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="no-blogs-container">
                <div className="no-blogs-icon">📖</div>
                <h3 className="no-blogs-title">No Articles Available</h3>
                <p className="no-blogs-text">
                  We're working on bringing you amazing content. Check back soon for expert insights and guides!
                </p>
              </div>
            )}

            {totalPages > 1 && (
              <nav className="pagination-container" role="navigation" aria-label="Blog pagination">
                <div className="pagination">
                  <button
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                    className="pagination-btn pagination-prev"
                    aria-label="Previous page"
                  >
                    <span className="pagination-icon">←</span>
                    <span className="pagination-text">Previous</span>
                  </button>
                  
                  <div className="pagination-info">
                    <span className="current-page">{currentPage}</span>
                    <span className="page-separator">of</span>
                    <span className="total-pages">{totalPages}</span>
                  </div>
                  
                  <button
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    className="pagination-btn pagination-next"
                    aria-label="Next page"
                  >
                    <span className="pagination-text">Next</span>
                    <span className="pagination-icon">→</span>
                  </button>
                </div>
              </nav>
            )}
          </main>
        </div>
      </div>
    </>
  );
};

export default BlogPage;