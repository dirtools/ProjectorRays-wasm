/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

#ifndef PROJECTORRAYS_EMSCRIPTEN_BOOST_ENDIAN_CONVERSION_HPP
#define PROJECTORRAYS_EMSCRIPTEN_BOOST_ENDIAN_CONVERSION_HPP

#include <cstdint>
#include <cstring>

namespace boost {
namespace endian {

inline uint16_t load_little_u16(const void *src) {
	const uint8_t *p = static_cast<const uint8_t *>(src);
	return (uint16_t)p[0] | (uint16_t)(p[1] << 8);
}

inline uint16_t load_big_u16(const void *src) {
	const uint8_t *p = static_cast<const uint8_t *>(src);
	return (uint16_t)(p[0] << 8) | (uint16_t)p[1];
}

inline uint32_t load_little_u32(const void *src) {
	const uint8_t *p = static_cast<const uint8_t *>(src);
	return (uint32_t)p[0]
		| ((uint32_t)p[1] << 8)
		| ((uint32_t)p[2] << 16)
		| ((uint32_t)p[3] << 24);
}

inline uint32_t load_big_u32(const void *src) {
	const uint8_t *p = static_cast<const uint8_t *>(src);
	return ((uint32_t)p[0] << 24)
		| ((uint32_t)p[1] << 16)
		| ((uint32_t)p[2] << 8)
		| (uint32_t)p[3];
}

inline uint64_t load_little_u64(const void *src) {
	const uint8_t *p = static_cast<const uint8_t *>(src);
	return (uint64_t)p[0]
		| ((uint64_t)p[1] << 8)
		| ((uint64_t)p[2] << 16)
		| ((uint64_t)p[3] << 24)
		| ((uint64_t)p[4] << 32)
		| ((uint64_t)p[5] << 40)
		| ((uint64_t)p[6] << 48)
		| ((uint64_t)p[7] << 56);
}

inline uint64_t load_big_u64(const void *src) {
	const uint8_t *p = static_cast<const uint8_t *>(src);
	return ((uint64_t)p[0] << 56)
		| ((uint64_t)p[1] << 48)
		| ((uint64_t)p[2] << 40)
		| ((uint64_t)p[3] << 32)
		| ((uint64_t)p[4] << 24)
		| ((uint64_t)p[5] << 16)
		| ((uint64_t)p[6] << 8)
		| (uint64_t)p[7];
}

inline void store_little_u16(void *dest, uint16_t value) {
	uint8_t *p = static_cast<uint8_t *>(dest);
	p[0] = (uint8_t)(value & 0xff);
	p[1] = (uint8_t)((value >> 8) & 0xff);
}

inline void store_big_u16(void *dest, uint16_t value) {
	uint8_t *p = static_cast<uint8_t *>(dest);
	p[0] = (uint8_t)((value >> 8) & 0xff);
	p[1] = (uint8_t)(value & 0xff);
}

inline void store_little_u32(void *dest, uint32_t value) {
	uint8_t *p = static_cast<uint8_t *>(dest);
	p[0] = (uint8_t)(value & 0xff);
	p[1] = (uint8_t)((value >> 8) & 0xff);
	p[2] = (uint8_t)((value >> 16) & 0xff);
	p[3] = (uint8_t)((value >> 24) & 0xff);
}

inline void store_big_u32(void *dest, uint32_t value) {
	uint8_t *p = static_cast<uint8_t *>(dest);
	p[0] = (uint8_t)((value >> 24) & 0xff);
	p[1] = (uint8_t)((value >> 16) & 0xff);
	p[2] = (uint8_t)((value >> 8) & 0xff);
	p[3] = (uint8_t)(value & 0xff);
}

inline void store_little_u64(void *dest, uint64_t value) {
	uint8_t *p = static_cast<uint8_t *>(dest);
	p[0] = (uint8_t)(value & 0xff);
	p[1] = (uint8_t)((value >> 8) & 0xff);
	p[2] = (uint8_t)((value >> 16) & 0xff);
	p[3] = (uint8_t)((value >> 24) & 0xff);
	p[4] = (uint8_t)((value >> 32) & 0xff);
	p[5] = (uint8_t)((value >> 40) & 0xff);
	p[6] = (uint8_t)((value >> 48) & 0xff);
	p[7] = (uint8_t)((value >> 56) & 0xff);
}

inline void store_big_u64(void *dest, uint64_t value) {
	uint8_t *p = static_cast<uint8_t *>(dest);
	p[0] = (uint8_t)((value >> 56) & 0xff);
	p[1] = (uint8_t)((value >> 48) & 0xff);
	p[2] = (uint8_t)((value >> 40) & 0xff);
	p[3] = (uint8_t)((value >> 32) & 0xff);
	p[4] = (uint8_t)((value >> 24) & 0xff);
	p[5] = (uint8_t)((value >> 16) & 0xff);
	p[6] = (uint8_t)((value >> 8) & 0xff);
	p[7] = (uint8_t)(value & 0xff);
}

} // namespace endian
} // namespace boost

#endif // PROJECTORRAYS_EMSCRIPTEN_BOOST_ENDIAN_CONVERSION_HPP
