import axios from 'axios'
import 'dotenv/config'

const axiosInstance = axios.create({ baseURL: process.env.API || '' })

export async function login(email: string): Promise<string> {
  type GenerateTokenResponse = {
    data: {
      generateToken: {
        result: {
          token: string
        }
      }
    }
  }

  type AuthMeta = {
    code: string
    error: string
    message: string
  }

  type AuthInfo = {
    token: string
    tokenExpiry: number
    tokenRefresh: string
  }

  type User = {
    address: string
    addressCity: string
    addressDistrict: string
    addressPostalCode: string
    addressProvince: string
    birthDate: string
    email: string
    gender: string
    isActive: boolean
    isPurchasers: boolean
    isReseller: boolean
    isSubscriber: boolean
    isVerifiedEmail: boolean
    isVerifiedPhone: boolean
    memberLevel: string
    name: string
    phone: string
    points: number
    userId: number
  }

  type SignInResult = {
    auth: AuthInfo
    firstLogin: boolean
    message: string
    status: boolean
    user: User
  }

  type SignInByEmailResponse = {
    data: {
      signInByEmail: {
        meta: AuthMeta
        result: SignInResult
      }
    }
  }

  try {
    const { data: dataToken } = await axiosInstance.post<GenerateTokenResponse>(
      '',
      {
        operationName: 'generateToken',
        variables: {},
        query:
          'query generateToken{generateToken{__typename meta{__typename message error code}result{token}}}',
      },
      { headers: { 'x-action': 'generate_token' } }
    )
    const token = dataToken.data.generateToken.result.token
    const { data: dataAuth } = await axiosInstance.post<SignInByEmailResponse>(
      '',
      {
        operationName: 'signInByEmail',
        variables: {
          input: {
            email,
            password: process.env.PASSWORD || '',
          },
        },
        query:
          'mutation signInByEmail($input: signInByEmailReq!) {\n  signInByEmail(input: $input) {\n    result {\n      auth {\n        token\n        tokenRefresh\n        tokenExpiry\n      }\n      user {\n        name\n        email\n        phone\n        isSubscriber\n        memberLevel\n        points\n        address\n        addressCity\n        addressDistrict\n        addressProvince\n        addressPostalCode\n        birthDate\n        isActive\n        userId\n        isReseller\n        isVerifiedEmail\n        isVerifiedPhone\n        isPurchasers\n        gender\n      }\n      message\n      status\n      firstLogin\n    }\n    meta {\n      error\n      message\n      code\n    }\n  }\n}\n',
      },
      { headers: { Authorization: `Bearer ${token}` } }
    )

    return dataAuth.data.signInByEmail.result.auth.token
  } catch (error) {
    console.error(error)
  }

  return ''
}

export async function getAddressId(token: string): Promise<number> {
  type Meta = {
    code: string
    error: string
    keyword: string | null
    message: string
    page: number | null
    size: number | null
    sort: string | null
    sortType: string | null
    totalData: number
    totalPage: number
  }

  type AddressItem = {
    addressDetail: string
    addressID: number
    addressLabel: string
    addressName: string
    addressPhone: string
    addressZipCode: string
    districtID: number
    districtName: string
    isPrimary: boolean
    isSelected: boolean
    isSelectedNew: boolean
    latitude: string
    longitude: string
    pinPointAddress: string
    provinceID: number
    provinceName: string
    subdistrictID: number
    subdistrictName: string
  }

  type GetAddressListResponse = {
    data: {
      getAddressList: {
        meta: Meta
        result: AddressItem[]
      }
    }
  }

  try {
    const { data } = await axiosInstance.post<GetAddressListResponse>(
      '',
      {
        operationName: 'getAddressList',
        variables: {
          size: 1,
          page: 1,
        },
        query:
          'query getAddressList($size: Int, $page: Int, $keyword: String) {\n  getAddressList(size: $size, page: $page, keyword: $keyword) {\n    meta {\n      page\n      size\n      sort\n      sortType\n      keyword\n      totalData\n      totalPage\n      message\n      error\n      code\n    }\n    result {\n      isSelected\n      isSelectedNew\n      isPrimary\n      addressID\n      addressName\n      addressPhone\n      addressLabel\n      addressZipCode\n      addressDetail\n      latitude\n      longitude\n      provinceID\n      provinceName\n      districtName\n      districtID\n      subdistrictName\n      subdistrictID\n      pinPointAddress\n    }\n  }\n}\n',
      },
      { headers: { Authorization: `Bearer ${token}` } }
    )

    return data.data.getAddressList.result[0].addressID
  } catch (error) {
    console.error(error)
  }

  return 0
}

export async function checkOut({
  addressId,
  token,
}: {
  addressId: number
  token: string
}): Promise<boolean> {
  type Meta = {
    code: string
    error: string
    message: string
  }

  type Entry = {
    data: {
      [operationName: string]: {
        meta: Meta
        result: any
      }
    }
  }

  try {
    const { data } = await axiosInstance.post<Entry[]>(
      '',
      [
        {
          operationName: 'processCheckoutV2',
          variables: {},
          query:
            'query processCheckoutV2 {\n  processCheckoutV2 {\n    meta {\n      message\n      error\n      code\n    }\n    result {\n      isContinueProcessCheckout\n      isGoToNewCheckout\n      isAddressAvailable\n    }\n  }\n}\n',
        },
        {
          operationName: 'updateSummaryShipping',
          variables: {
            request: {
              addressID: addressId,
              shippingID: 4,
            },
          },
          query:
            'mutation updateSummaryShipping($request: UpdateSummaryShippingRequest!) {\n  updateSummaryShipping(request: $request) {\n    meta {\n      message\n      error\n      code\n    }\n    result {\n      status\n    }\n  }\n}\n',
        },
        {
          operationName: 'updateSummaryPayment',
          variables: {
            request: {
              paymentID: 57,
              paymentCode: 'VABCA',
              paymentParentCode: 'VirtualAccount',
              paymentName: 'Virtual Account',
              paymentChildName: 'BCA Virtual Account',
              minimumAmount: 10000,
            },
          },
          query:
            'mutation updateSummaryPayment($request: UpdateSummaryPaymentRequest!) {\n  updateSummaryPayment(request: $request) {\n    meta {\n      message\n      error\n      code\n    }\n    result {\n      status\n    }\n  }\n}\n',
        },
        {
          operationName: 'updateSummaryJTPoint',
          variables: { request: { isJTPoint: true } },
          query:
            'mutation updateSummaryJTPoint($request: UpdateSummaryJTPointRequest!) {\n  updateSummaryJTPoint(request: $request) {\n    meta {\n      message\n      error\n      code\n    }\n    result {\n      status\n    }\n  }\n}\n',
        },
        {
          operationName: 'getSummaryCheckoutV2',
          variables: { request: { isChanges: true } },
          query:
            'query getSummaryCheckoutV2($request: SummaryCheckoutV2Request!) {\n  getSummaryCheckoutV2(request: $request) {\n    meta {\n      message\n      error\n      code\n    }\n    result {\n      quantity\n      voucherAmount\n      JTPointUsed\n      bankPointRewardUsed\n      insuranceAmount\n      total\n      subTotal\n      pointReward\n      shipping {\n        shippingAmount\n        shippingFinalAmount\n      }\n      minimumPaymentInfo\n    }\n  }\n}\n',
        },
        {
          operationName: 'getCheckoutSKUList',
          variables: { request: { isValidate: false } },
          query:
            'query getCheckoutSKUList($request: CheckoutSKUListRequest) {\n  getCheckoutSKUList(request: $request) {\n    meta {\n      message\n      error\n      code\n    }\n    result {\n      items {\n        productID\n        productImage\n        productImageLight\n        productName\n        productSKU\n        productFinalPrice\n        productQuantity\n        productWeight\n        productBrandCode\n        productInfo {\n          message\n          quantity\n          stock\n        }\n        isBundling\n        isPreorder\n        deliveryEstimate\n        analytic {\n          brandID\n          brandName\n          categoryID\n          categoryName\n          function\n          lugWidth\n          movement\n          productBrand\n          productColour\n          productID\n          productImage\n          productLink\n          productName\n          productPrice\n          productSku\n          strapMaterial\n          subBrandID\n          subBrandName\n          productQty\n          subtotal\n          items {\n            index\n            item_id\n            item_name\n            item_brand\n            item_category\n            item_category2\n            item_category3\n            item_category4\n            item_category5\n            item_variant\n            item_list_id\n            item_list_name\n            coupon\n            price\n            quantity\n            discount\n            currency\n            affiliation\n          }\n        }\n        productBundling {\n          productID\n          productImage\n          productImageLight\n          productName\n          productSKU\n          productFinalPrice\n          productQuantity\n          productWeight\n          productBrandCode\n          productInfo {\n            message\n            quantity\n            stock\n          }\n          analytic {\n            brandID\n            brandName\n            categoryID\n            categoryName\n            function\n            lugWidth\n            movement\n            productBrand\n            productColour\n            productID\n            productImage\n            productLink\n            productName\n            productPrice\n            productSku\n            strapMaterial\n            subBrandID\n            subBrandName\n            productQty\n            subtotal\n            items {\n              index\n              item_id\n              item_name\n              item_brand\n              item_category\n              item_category2\n              item_category3\n              item_category4\n              item_category5\n              item_variant\n              item_list_id\n              item_list_name\n              coupon\n              price\n              quantity\n              discount\n              currency\n              affiliation\n            }\n          }\n        }\n      }\n    }\n  }\n}\n',
        },
        {
          operationName: 'addOrderV2',
          variables: { request: {} },
          query:
            'mutation addOrderV2($request: addOrderV2Request) {\n  addOrderV2(request: $request) {\n    meta {\n      message\n      error\n      code\n    }\n    result {\n      status\n      payment {\n        status\n        orderId\n        redirectUrl\n      }\n    }\n  }\n}\n',
        },
      ],
      { headers: { Authorization: `Bearer ${token}` } }
    )

    return data.every((entry) => {
      const key = Object.keys(entry.data)[0]
      const metaCode = entry.data[key]?.meta?.code
      return metaCode === 'success'
    })
  } catch (error) {
    console.error(error)
  }

  return false
}
