'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useStudents } from '@/lib/hooks'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

function MaterialIcon({ icon, className, style, children }: { icon?: string; className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return <span className={`material-symbols-outlined ${className || ''}`} style={style}>{icon || children}</span>
}

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
  const { students } = useStudents(school?.id)
  const toast = useToast()
  const [books, setBooks] = useState<Book[]>([])
  const [checkouts, setCheckouts] = useState<Checkout[]>([])
  const [history, setHistory] = useState<Checkout[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'books' | 'checkouts' | 'history'>('books')
  const [showAddBook, setShowAddBook] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [showEditBook, setShowEditBook] = useState(false)
  const [editBookId, setEditBookId] = useState<string | null>(null)
  const [editBook, setEditBook] = useState({
    title: '',
    author: '',
    isbn: '',
    category: '',
    copies: '1',
    location: '',
  })
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
      const [booksRes, checkoutsRes, historyRes] = await Promise.all([
        supabase.from('books').select('*').eq('school_id', school.id).order('title'),
        supabase.from('book_checkouts').select('*, books(title), students(first_name, last_name)').eq('school_id', school.id).is('return_date', null),
        supabase.from('book_checkouts').select('*, books(title), students(first_name, last_name)').eq('school_id', school.id).not('return_date', 'is', null).order('return_date', { ascending: false }),
      ])

      if (booksRes.error) throw booksRes.error
      if (checkoutsRes.error) throw checkoutsRes.error
      if (historyRes.error) throw historyRes.error

      setBooks(booksRes.data || [])
      setCheckouts(checkoutsRes.data || [])
      setHistory(historyRes.data || [])
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

  const handleEditBook = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editBookId) return

    try {
      const { error } = await supabase.from('books').update({
        title: editBook.title,
        author: editBook.author,
        isbn: editBook.isbn || null,
        category: editBook.category || null,
        copies: Number(editBook.copies),
        location: editBook.location || null,
      }).eq('id', editBookId)

      if (error) throw error
      toast.success('Book updated')
      setShowEditBook(false)
      setEditBookId(null)
      fetchData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update book')
    }
  }

  const openEditBook = (book: Book) => {
    setEditBookId(book.id)
    setEditBook({
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      category: book.category,
      copies: String(book.copies),
      location: book.location,
    })
    setShowEditBook(true)
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

      const book = books.find(b => b.id === newCheckout.book_id)
      if (book) {
        const { error: updateError } = await supabase.from('books').update({ available: book.available - 1 }).eq('id', book.id)
        if (updateError) throw updateError
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
      const { error: checkoutError } = await supabase.from('book_checkouts').update({ return_date: new Date().toISOString().split('T')[0] }).eq('id', checkoutId)
      if (checkoutError) throw checkoutError

      const book = books.find(b => b.id === bookId)
      if (book) {
        const { error: bookError } = await supabase.from('books').update({ available: book.available + 1 }).eq('id', bookId)
        if (bookError) throw bookError
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
      const { error } = await supabase.from('books').delete().eq('id', id)
      if (error) throw error
      toast.success('Book deleted')
      fetchData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const filteredBooks = books.filter(b =>
    b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.author.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const today = new Date().toISOString().split('T')[0]

  return (
    <div style={{ padding: '32px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#002045]">Library</h1>
          <p className="text-[#5c6670] mt-1">Manage books and checkouts</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowCheckout(true)} className="btn btn-secondary">
            <MaterialIcon icon="menu_book" className="text-lg" />
            Checkout Book
          </button>
          <button onClick={() => setShowAddBook(true)} className="btn btn-primary">
            <MaterialIcon icon="add" className="text-lg" />
            Add Book
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
          <div className="text-2xl font-bold text-[#002045]">{books.length}</div>
          <div className="text-sm text-[#5c6670] mt-1">Total Books</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
          <div className="text-2xl font-bold text-[#006e1c]">{books.reduce((sum, b) => sum + b.available, 0)}</div>
          <div className="text-sm text-[#5c6670] mt-1">Available</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8eaed] p-4 text-center">
          <div className="text-2xl font-bold text-[#b86e00]">{checkouts.length}</div>
          <div className="text-sm text-[#5c6670] mt-1">Checked Out</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#e8eaed] p-2 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setTab('books')}
            className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${tab === 'books' ? 'bg-[#002045] text-white' : 'text-[#5c6670] hover:bg-[#f8fafb]'}`}
          >
            Books
          </button>
          <button
            onClick={() => setTab('checkouts')}
            className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${tab === 'checkouts' ? 'bg-[#002045] text-white' : 'text-[#5c6670] hover:bg-[#f8fafb]'}`}
          >
            Checkouts ({checkouts.length})
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${tab === 'history' ? 'bg-[#002045] text-white' : 'text-[#5c6670] hover:bg-[#f8fafb]'}`}
          >
            History ({history.length})
          </button>
        </div>
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
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-[#e8eaed] p-4">
                  <div className="w-full h-4 bg-[#e8eaed] rounded" />
                </div>
              ))}
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MaterialIcon className="text-3xl text-gray-400">menu_book</MaterialIcon>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">No books</h3>
              <p className="text-gray-500">Add your first book</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredBooks.map((book) => (
                <div key={book.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                  <div className="h-32 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                    <MaterialIcon className="text-5xl text-blue-300">menu_book</MaterialIcon>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-gray-900 mb-1 line-clamp-2">{book.title}</h3>
                    <p className="text-sm text-gray-500 mb-2">{book.author}</p>
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${book.available > 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {book.available}/{book.copies} available
                      </span>
                      <div className="flex gap-1">
                        <button onClick={() => openEditBook(book)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg">
                          <MaterialIcon className="text-lg">edit</MaterialIcon>
                        </button>
                        <button onClick={() => deleteBook(book.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                          <MaterialIcon className="text-lg">delete</MaterialIcon>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'checkouts' && (
        <div className="bg-white rounded-2xl border border-[#e8eaed] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#f8fafb]">
                <tr>
                  <th className="text-left p-4 text-sm font-semibold text-[#191c1d]">Book</th>
                  <th className="text-left p-4 text-sm font-semibold text-[#191c1d]">Student</th>
                  <th className="text-left p-4 text-sm font-semibold text-[#191c1d]">Checkout Date</th>
                  <th className="text-left p-4 text-sm font-semibold text-[#191c1d]">Due Date</th>
                  <th className="text-left p-4 text-sm font-semibold text-[#191c1d]">Status</th>
                  <th className="text-left p-4 text-sm font-semibold text-[#191c1d]"></th>
                </tr>
              </thead>
              <tbody>
                {checkouts.map((checkout) => {
                  const isOverdue = new Date(checkout.due_date) < new Date()
                  return (
                    <tr key={checkout.id} className="border-t border-[#e8eaed]">
                      <td className="p-4 font-medium text-[#191c1d]">{(checkout as any).books?.title}</td>
                      <td className="p-4 text-[#191c1d]">{(checkout as any).students?.first_name} {(checkout as any).students?.last_name}</td>
                      <td className="p-4 text-[#191c1d]">{new Date(checkout.checkout_date).toLocaleDateString()}</td>
                      <td className="p-4 text-[#191c1d]">{new Date(checkout.due_date).toLocaleDateString()}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-lg text-xs font-medium ${isOverdue ? 'bg-[#fef2f2] text-[#ba1a1a]' : 'bg-[#fff3e0] text-[#b86e00]'}`}>
                          {isOverdue ? 'Overdue' : 'On Loan'}
                        </span>
                      </td>
                      <td className="p-4">
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
        </div>
      )}

      {tab === 'history' && (
        <div className="bg-white rounded-2xl border border-[#e8eaed] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#f8fafb]">
                <tr>
                  <th className="text-left p-4 text-sm font-semibold text-[#191c1d]">Book</th>
                  <th className="text-left p-4 text-sm font-semibold text-[#191c1d]">Student</th>
                  <th className="text-left p-4 text-sm font-semibold text-[#191c1d]">Checkout Date</th>
                  <th className="text-left p-4 text-sm font-semibold text-[#191c1d]">Return Date</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-gray-500">No returned books yet</td>
                  </tr>
                ) : (
                  history.map((checkout) => (
                    <tr key={checkout.id} className="border-t border-[#e8eaed]">
                      <td className="p-4 font-medium text-[#191c1d]">{(checkout as any).books?.title}</td>
                      <td className="p-4 text-[#191c1d]">{(checkout as any).students?.first_name} {(checkout as any).students?.last_name}</td>
                      <td className="p-4 text-[#191c1d]">{new Date(checkout.checkout_date).toLocaleDateString()}</td>
                      <td className="p-4 text-[#191c1d]">{checkout.return_date ? new Date(checkout.return_date).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddBook && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowAddBook(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-[#e8eaed]">
              <h2 className="text-lg font-semibold text-[#191c1d]">Add Book</h2>
            </div>
            <form onSubmit={handleAddBook} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Title</label>
                <input type="text" value={newBook.title} onChange={(e) => setNewBook({...newBook, title: e.target.value})} className="input" required />
              </div>
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Author</label>
                <input type="text" value={newBook.author} onChange={(e) => setNewBook({...newBook, author: e.target.value})} className="input" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">ISBN</label>
                  <input type="text" value={newBook.isbn} onChange={(e) => setNewBook({...newBook, isbn: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Category</label>
                  <input type="text" value={newBook.category} onChange={(e) => setNewBook({...newBook, category: e.target.value})} className="input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Copies</label>
                  <input type="number" value={newBook.copies} onChange={(e) => setNewBook({...newBook, copies: e.target.value})} className="input" min="1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Location</label>
                  <input type="text" value={newBook.location} onChange={(e) => setNewBook({...newBook, location: e.target.value})} className="input" />
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

      {showEditBook && editBookId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => { setShowEditBook(false); setEditBookId(null) }}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-[#e8eaed]">
              <h2 className="text-lg font-semibold text-[#191c1d]">Edit Book</h2>
            </div>
            <form onSubmit={handleEditBook} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Title</label>
                <input type="text" value={editBook.title} onChange={(e) => setEditBook({...editBook, title: e.target.value})} className="input" required />
              </div>
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Author</label>
                <input type="text" value={editBook.author} onChange={(e) => setEditBook({...editBook, author: e.target.value})} className="input" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">ISBN</label>
                  <input type="text" value={editBook.isbn} onChange={(e) => setEditBook({...editBook, isbn: e.target.value})} className="input" />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Category</label>
                  <input type="text" value={editBook.category} onChange={(e) => setEditBook({...editBook, category: e.target.value})} className="input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Copies</label>
                  <input type="number" value={editBook.copies} onChange={(e) => setEditBook({...editBook, copies: e.target.value})} className="input" min="1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Location</label>
                  <input type="text" value={editBook.location} onChange={(e) => setEditBook({...editBook, location: e.target.value})} className="input" />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowEditBook(false); setEditBookId(null) }} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn btn-primary flex-1">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCheckout && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowCheckout(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-[#e8eaed]">
              <h2 className="text-lg font-semibold text-[#191c1d]">Checkout Book</h2>
            </div>
            <form onSubmit={handleCheckout} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Select Book</label>
                <select value={newCheckout.book_id} onChange={(e) => setNewCheckout({...newCheckout, book_id: e.target.value})} className="input" required>
                  <option value="">Choose book</option>
                  {books.filter(b => b.available > 0).map((b) => (
                    <option key={b.id} value={b.id}>{b.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Student</label>
                <select value={newCheckout.student_id} onChange={(e) => setNewCheckout({...newCheckout, student_id: e.target.value})} className="input" required>
                  <option value="">Choose student</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#191c1d] mb-2 block">Due Date</label>
                <input type="date" value={newCheckout.due_date} onChange={(e) => setNewCheckout({...newCheckout, due_date: e.target.value})} className="input" required min={today} />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowCheckout(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn btn-primary flex-1">Checkout</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
