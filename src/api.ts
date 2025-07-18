import axios from 'axios'
import type { Condition, Product, Source } from './types'

/**
 * Axios instance dengan baseURL dari environment variable `API`.
 */
const axiosInstance = axios.create({ baseURL: process.env.API || '' })

/**
 * Tipe untuk response dari API SearchProductV5 (GraphQL).
 */
type SearchProductV5Response = {
  data: {
    searchProductV5: {
      data: SearchProductV5Data
      __typename: 'SearchProductV5Response'
    }
  }
}

type SearchProductV5Data = {
  totalDataText: string
  products: SearchProductV5Product[]
  __typename: 'SearchProductV5Data'
}

type SearchProductV5Product = {
  oldID: number
  id: string
  name: string
  url: string
  mediaURL: SearchProductV5MediaURL
  price: SearchProductV5Price
  shop: SearchProductV5Shop
  rating: string
  labelGroups: any[] // Gunakan tipe lebih spesifik jika kamu tahu struktur sebenarnya
  __typename: 'searchProductV5Product'
}

type SearchProductV5MediaURL = {
  image: string
  image300: string
  __typename: 'SearchProductV5MediaURL'
}

type SearchProductV5Price = {
  text: string
  number: number
  discountPercentage: number
  __typename: 'SearchProductV5Price'
}

type SearchProductV5Shop = {
  oldID: number
  id: string
  name: string
  city: string
  tier: number
  __typename: 'SearchProductV5Shop'
}

/**
 * Melakukan pencarian produk berdasarkan kata kunci, sumber, dan kondisi produk.
 *
 * @param q - Kata kunci pencarian (contoh: "vivo v50")
 * @param source - Sumber pencarian (misalnya "search" untuk semua, atau "universe" untuk lebih detail)
 * @param condition - Kondisi produk (opsional: "1" untuk baru, "2" untuk bekas)
 * @returns Array berisi produk hasil pencarian yang telah dipetakan ke bentuk standar `Product`
 */
export async function search({
  q,
  source,
  condition,
}: {
  q: string
  source: Source
  condition?: Condition
}): Promise<Product[]> {
  const { data } = await axiosInstance.post<SearchProductV5Response>(
    '',
    {
      operationName: 'SearchProductV5Query',
      variables: {
        params: `device=desktop&enter_method=normal_search&l_name=sre&navsource=&ob=9&page=1&q=${encodeURI(
          q
        )}&related=true&rows=10&safe_search=false&sc=&scheme=https&shipping=&show_adult=false&source=${source}&srp_component_id=&srp_page_id=&srp_page_title=&st=product&start=0&topads_bucket=true&unique_id=&user_addressId=&user_cityId=176&user_districtId=2274&user_id=&user_lat=&user_long=&user_postCode=&user_warehouseId=&variants=&warehouses=&condition=${condition}`,
      },
      query:
        'query SearchProductV5Query($params:String!){searchProductV5(params:$params){data{totalDataText products{oldID:id id:id_str_auto_ name url mediaURL{image image300 __typename}price{text number discountPercentage __typename}shop{oldID:id id:id_str_auto_ name city tier __typename}rating labelGroups{position title __typename}__typename}__typename}__typename}}',
    },
    {
      headers: {
        'user-agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
      },
    }
  )

  return data.data.searchProductV5.data.products.map((product) => ({
    name: product.name,
    url: product.url,
    image: product.mediaURL.image300,
    price: product.price.text,
    shopName: product.shop.name,
    shopCity: product.shop.city,
  }))
}
