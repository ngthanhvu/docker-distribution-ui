package cache

import (
	"strings"
	"sync"
	"time"
)

type entry struct {
	val     any
	expires time.Time
}

// Cache is a simple in-memory TTL cache.
type Cache struct {
	mu  sync.RWMutex
	m   map[string]entry
	ttl time.Duration
}

func New(ttl time.Duration) *Cache {
	c := &Cache{m: make(map[string]entry), ttl: ttl}
	if ttl > 0 {
		go c.janitor()
	}
	return c
}

func (c *Cache) Get(key string) (any, bool) {
	c.mu.RLock()
	e, ok := c.m[key]
	c.mu.RUnlock()
	if !ok || time.Now().After(e.expires) {
		return nil, false
	}
	return e.val, true
}

func (c *Cache) Set(key string, val any) {
	c.mu.Lock()
	c.m[key] = entry{val: val, expires: time.Now().Add(c.ttl)}
	c.mu.Unlock()
}

// DeletePrefix removes every key starting with the given prefix.
func (c *Cache) DeletePrefix(prefix string) {
	c.mu.Lock()
	for k := range c.m {
		if strings.HasPrefix(k, prefix) {
			delete(c.m, k)
		}
	}
	c.mu.Unlock()
}

func (c *Cache) janitor() {
	t := time.NewTicker(time.Minute)
	defer t.Stop()
	for range t.C {
		now := time.Now()
		c.mu.Lock()
		for k, e := range c.m {
			if now.After(e.expires) {
				delete(c.m, k)
			}
		}
		c.mu.Unlock()
	}
}
