/**
 * Representasi produk hasil pencarian katalog.
 */
export type Product = {
  /** Nama produk */
  name: string

  /** URL ke halaman produk */
  url: string

  /** URL gambar produk (ukuran 300px biasanya) */
  image: string

  /** Harga produk dalam bentuk teks (misalnya "Rp 2.499.000") */
  price: string

  /** Nama toko yang menjual produk */
  shopName: string

  /** Kota tempat toko berada */
  shopCity: string
}

/**
 * Sumber data katalog:
 * - 'search': hasil pencarian umum
 * - 'universe': hasil pencarian lebih spesifik (misalnya berdasarkan kondisi barang)
 */
export type Source = 'search' | 'universe'

/**
 * Kondisi produk:
 * - '1': Baru
 * - '2': Bekas
 * - '1%232': Baru dan Bekas (encoded dari '1#2')
 */
export type Condition = '1' | '2' | '1%232'
