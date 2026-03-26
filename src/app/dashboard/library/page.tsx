'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

interface Book {
  id: string
  title: string
  author: string
  isbn: string
  category: string
  copies: number
  available: number
  location: string
  created_at: string
}

interface Checkout {
  id: string
  book_id: string
  student_id: string
  checkout_date: string
  due_date: string
  return_date: string | null
  books?: { title: string }
  students?: { first_name: string, last_name: string }
}

export default function LibraryPage() {
  const { school } = useAuth()
  const toast = useToast()
  const [books, setBooks] = useState<Book[]>([])
  const [checkouts, setCheckouts] = useState<Checkout[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'books' | 'checkouts'>('books')
  const [showAddBook, setShowAddBook] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [newBook, setNewBook] = useState({
    title: '',
    author: '',
    isbn: '',
    category: '',
    copies: '1',
    location: '',
  })
  const [newCheckout, setNewCheckout] = useState({
    book_id: '',
    student_id: '',
    due_date: '',
  })

  useEffect(() => {
    fetchData()
  }, [school?.id])

  const fetchData = async () => {
    if (!school?.id) return
    try {
      const [booksRes, checkoutsRes] = await Promise.all([
        supabase.from('books').select('*').eq('school_id', school.id).order('title'),
        supabase.from('book_checkouts').select('*, books(title), students(first_name, last_name)').eq('school_id', school.id).is('return_date', null)
      ])
      
      setBooks(booksRes.data || [])
      setCheckouts(checkoutsRes.data || [])
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id) return

    try {
      const { error } = await supabase.from('books').insert({
        school_id: school.id,
        title: newBook.title,
        author: newBook.author,
        isbn: newBook.isbn || null,
        category: newBook.category || null,
        copies: Number(newBook.copies) || 1,
        available: Number(newBook.copies) || 1,
        location: newBook.location || null,
      })

      if (error) throw error
      toast.success('Book added')
      setShowAddBook(false)
      setNewBook({ title: '', author: '', isbn: '', category: '', copies: '1', location: '' })
      fetchData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add book')
    }
  }

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!school?.id) return

    try {
      const { error } = await supabase.from('book_checkouts').insert({
        school_id: school.id,
        book_id: newCheckout.book_id,
        student_id: newCheckout.student_id,
        checkout_date: new Date().toISOString().split('T')[0],
        due_date: newCheckout.due_date,
        return_date: null,
      })

      if (error) throw error

      // Update book available count
      const book = books.find(b => b.id === newCheckout.book_id)
      if (book) {
        await supabase.from('books').update({ available: book.available - 1 }).eq('id', book.id)
      }

      toast.success('Book checked out')
      setShowCheckout(false)
      setNewCheckout({ book_id: '', student_id: '', due_date: '' })
      fetchData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to checkout')
    }
  }

  const returnBook = async (checkoutId: string, bookId: string) => {
    try {
      await supabase.from('book_checkouts').update({ return_date: new Date().toISOString().split('T')[0] }).eq('id', checkoutId)
      
      const book = books.find(b => b.id === bookId)
      if (book) {
        await supabase.from('books').update({ available: book.available + 1 }).eq('id', bookId)
      }

      toast.success('Book returned')
      fetchData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to return')
    }
  }

  const deleteBook = async (id: string) => {
    if (!confirm('Delete this book?')) return
    try {
      await supabase.from('books').delete().eq('id', id)
      setBooks(books.filter(b => b.id !== id))
      toast.success('Book deleted')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const filteredBooks = books.filter(b => 
    b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.author.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Library</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage books and checkouts</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowCheckout(true)} className="btn btn-secondary">
            Checkout Book
          </button>
          <button onClick={() => setShowAddBook(true)} className="btn btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Book
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <div className="stat-value">{books.length}</div>
          <div className="stat-label">Total Books</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-green-600">{books.reduce((sum, b) => sum + b.available, 0)}</div>
          <div className="stat-label">Available</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-yellow-600">{checkouts.length}</div>
          <div className="stat-label">Checked Out</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs mb-6">
        <button onClick={() => setTab('books')} className={`tab ${tab === 'books' ? 'active' : ''}`}>
          Books
        </button>
        <button onClick={() => setTab('checkouts')} className={`tab ${tab === 'checkouts' ? 'active' : ''}`}>
          Checkouts ({checkouts.length})
        </button>
      </div>

      {tab === 'books' && (
        <>
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search books..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input sm:w-64"
            />
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="card"><div className="skeleton w-full h-4" /></div>)}
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No books</h3>
              <p className="text-gray-500 dark:text-gray-400">Add your first book</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Author</th>
                    <th>Category</th>
                    <th>Available</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBooks.map((book) => (
                    <tr key={book.id}>
                      <td className="font-medium text-gray-900 dark:text-white">{book.title}</td>
                      <td className="text-gray-600 dark:text-gray-400">{book.author}</td>
                      <td className="text-gray-600 dark:text-gray-400">{book.category || '-'}</td>
                      <td>
                        <span className={`badge ${book.available > 0 ? 'badge-success' : 'badge-danger'}`}>
                          {book.available}/{book.copies}
                        </span>
                      </td>
                      <td>
                        <button onClick={() => deleteBook(book.id)} className="p-2 text-gray-400 hover:text-red-600">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'checkouts' && (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Book</th>
                <th>Student</th>
                <th>Checkout Date</th>
                <th>Due Date</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {checkouts.map((checkout) => {
                const isOverdue = new Date(checkout.due_date) < new Date()
                return (
                  <tr key={checkout.id}>
                    <td className="font-medium text-gray-900 dark:text-white">{(checkout as any).books?.title}</td>
                    <td>{(checkout as any).students?.first_name} {(checkout as any).students?.last_name}</td>
                    <td>{new Date(checkout.checkout_date).toLocaleDateString()}</td>
                    <td>{new Date(checkout.due_date).toLocaleDateString()}</td>
                    <td>
                      <span className={`badge ${isOverdue ? 'badge-danger' : 'badge-warning'}`}>
                        {isOverdue ? 'Overdue' : 'On Loan'}
                      </span>
                    </td>
                    <td>
                      <button onClick={() => returnBook(checkout.id, checkout.book_id)} className="btn btn-sm btn-secondary">
                        Return
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Book Modal */}
      {showAddBook && (
        <div className="modal-overlay" onClick={() => setShowAddBook(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Book</h2>
            </div>
            <form onSubmit={handleAddBook} className="p-6 space-y-4">
              <div>
                <label className="label">Title</label>
                <input type="text" value={newBook.title} onChange={(e) => setNewBook({...newBook, title: e.target.value})} className="input" required />
              </div>
              <div>
                <label className="label">Author</label>
                <input type="text" value={newBook.author} onChange={(e) => setNewBook({...newBook, author: e.target.value})} className="input" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">ISBN</label>
                  <input type="text" value={newBook.isbn} onChange={(e) => setNewBook({...newBook, isbn: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="label">Copies</label>
                  <input type="number" value={newBook.copies} onChange={(e) => setNewBook({...newBook, copies: e.target.value})} className="input" min="1" />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddBook(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn btn-primary flex-1">Add Book</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
