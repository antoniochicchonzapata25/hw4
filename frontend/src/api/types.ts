// Shapes returned by the FastAPI backend (see backend/main.py).

export interface SizeStock {
  size: string
  quantity: number
}

export interface Product {
  product_id: string
  name: string
  garment_type: string
  description: string
  colors: string[]
  search_tags: string[]
  image_file_path: string
  image_url: string
  price: number
  total_stock: number
}

export interface ProductDetail extends Product {
  inventory: SizeStock[]
}
