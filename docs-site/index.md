---
layout: home
---

<script>
export default {
  mounted() {
    // a little trick to redirect to the default language
    // in this case, Chinese
    location.pathname = '/zh/'
  }
}
</script>